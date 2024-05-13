const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 3000;

require("dotenv").config();

const corsOptions = {
   origin: ["http://localhost:5173"],
   credentials: true,
   optionSuccessStatus: 200,
};

// middlewares:
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// creating middleware to verify JWT token:
const verifyToken = (req, res, next) => {
   const token = req.cookies?.token;
   console.log("token:::", token);
   if (!token) {
      return res.status(401).send({ message: "Unauthorized Access" });
   }

   if (token) {
      jwt.verify(token, process.env.JWT_API_SECRET, (error, decoded) => {
         if (error) {
            return res.status(401).send({ message: "Unauthorized Access" });
         }

         req.user = decoded;

         next();
      });
   }
};

// mongoDB

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.j7c4zww.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
   serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
   },
});

async function run() {
   try {
      // Connect the client to the server	(optional starting in v4.7)
      //   await client.connect();
      // Send a ping to confirm a successful connection
      //   await client.db("admin").command({ ping: 1 });

      const foodsCollection = client.db("sustainEats").collection("foods");
      const requestedFoodsCollection = client
         .db("sustainEats")
         .collection("requestedFoods");

      /****** APIs *********/

      /****** JWT Related APIs *********/

      // create a json web token using email
      app.post("/jwt", async (req, res) => {
         const user = req.body;
         console.log(user);
         const token = jwt.sign(user, process.env.JWT_API_SECRET, {
            expiresIn: "7d",
         });

         res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production" ? true : false,
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
         }).send({ success: true });
      });

      // removing token
      app.post("/logout", async (req, res) => {
         const user = req.body;
         console.log(`logging out`, user);

         // clearing cookie
         res.clearCookie("token", { maxAge: 0 }).send({ success: true });
      });

      /****** Available Food Related APIs *********/

      // get API to get all the foods with status available
      app.get("/foods", async (req, res) => {
         const query = {
            foodStatus: "Available",
         };
         const result = await foodsCollection.find(query).toArray();

         res.send(result);
      });

      // GET API to get foods filtered by who added them
      app.get("/foods/:email", verifyToken, async (req, res) => {
         const searchEmail = req.params.email;
         console.log("search email: ", searchEmail);
         console.log("token user: ", req?.user);

         if (searchEmail !== req?.user?.email) {
            return res.status(403).send({ message: "Forbidden Access" });
         }

         const filter = { "donor.donorEmail": searchEmail };

         const result = await foodsCollection.find(filter).toArray();
         res.send(result);
      });

      // GET Six foods from database with highest quantity
      app.get("/featured-foods", async (req, res) => {
         const query = { foodStatus: "Available" };
         const result = await foodsCollection
            .find(query)
            // limit korte hobe koyta porjonto amra dekhabo
            .limit(6)
            // er por sort korte hobe kon field amra ascending
            // or descending korbo. jehutu sort and limit akshathe
            // use kortesi, tai unique field arekta pass korte hobe
            // for future error avoid cases.
            .sort({ foodQuantity: -1, _id: 1 })
            .toArray();

         res.send(result);
      });

      // GET a single food data using id from params
      app.get("/food/:id", async (req, res) => {
         const id = req.params.id;
         const query = { _id: new ObjectId(id) };
         const result = await foodsCollection.findOne(query);
         res.send(result);
      });

      // Update a single food data using id
      app.put("/food/:id", verifyToken, async (req, res) => {
         const id = req.params.id;
         const updateData = req.body;
         const query = { _id: new ObjectId(id) };
         const options = { upsert: true };
         const updateDoc = {
            $set: {
               ...updateData,
            },
         };
         console.log(updateDoc);
         const result = await foodsCollection.updateOne(
            query,
            updateDoc,
            options
         );
         res.send(result);
      });

      // Add a food to database
      app.post("/foods", verifyToken, async (req, res) => {
         const food = req.body;
         console.log(food);

         const result = await foodsCollection.insertOne(food);
         res.send(result);
      });

      // update the status of a food item
      // PATCH: Update the bid status
      app.patch("/food/:id", async (req, res) => {
         const id = req.params.id;
         const foodStatus = req.body;
         console.log(foodStatus.foodStatus);

         const query = { _id: new ObjectId(id) };
         const updateDoc = {
            $set: {
               foodStatus: foodStatus.foodStatus,
            },
         };

         const result = await foodsCollection.updateOne(query, updateDoc);
         res.send(result);
      });

      // delete a food item using id
      app.delete("/food/:id", async (req, res) => {
         const deleteId = req.params.id;
         const query = { _id: new ObjectId(deleteId) };
         const result = await foodsCollection.deleteOne(query);

         res.send(result);
      });

      /****** Requested Food Related APIs *********/

      // GET API: Get all foods requested by who requested them, email.
      // GET API to get foods filtered by who added them
      app.get("/requested-foods/:email", verifyToken, async (req, res) => {
         const searchEmail = req.params.email;
         console.log("search email: sssss", searchEmail);
         console.log("token user: sssss", req?.user);

         if (searchEmail !== req?.user?.email) {
            return res.status(403).send({ message: "Forbidden Access" });
         }

         const filter = { req_email: searchEmail };

         const result = await requestedFoodsCollection.find(filter).toArray();
         res.send(result);
      });

      // POST API: Make a food request and save to Database.
      app.post("/request-food", async (req, res) => {
         const data = req.body;
         const result = await requestedFoodsCollection.insertOne(data);
         res.send(result);
      });

      console.log(
         "Pinged your deployment. You successfully connected to MongoDB!"
      );
   } finally {
      // Ensures that the client will close when you finish/error
      //   await client.close();
   }
}

// Call the run function to establish the connection and set up APIs
run().catch(console.dir);

// for testing
app.get("/", (req, res) => {
   res.send("sustainEats is Running");
});

// listen
app.listen(port, () => {
   console.log(`sustainEats is running at port: ${port}`);
});
