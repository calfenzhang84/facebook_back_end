import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import multer from "multer";
import {GridFsStorage} from "multer-gridfs-storage";
import Grid from "gridfs-stream";
import bodyParser from "body-parser";
import path from "path";
import Pusher from "pusher";
import mongoPosts from "./postModel.js"


Grid.mongo = mongoose.mongo;

// app config
const app = express();
const port = process.env.PORT || 9000;

// middlewares
app.use(bodyParser.json());
app.use(cors());

// db config
const mongoURI =
  "mongodb+srv://admin:admin@cluster0.xy5tn.mongodb.net/facebook-db?retryWrites=true&w=majority";


const pusher = new Pusher({
  appId: "1243795",
  key: "ed54a0146226fc615877",
  secret: "9edf5c95bd125beff3d0",
  cluster: "us3",
  useTLS: true
});



// for gridfsStorage (image)
const conn = mongoose.createConnection(mongoURI, {
  userCreateIndex: true,
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

let gfs;

conn.once("open", () => {
  console.log("DB connected");
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection("images");
});

const storage = new GridFsStorage({
  url: mongoURI,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      const filename = `image-${Date.now()}${path.extname(file.originalname)}`;

      const fileInfo = {
        filename: filename,
        bucketName: "images",
        // bucketName should be the same as colledtion name
      };

      resolve(fileInfo);
    });
  },
});


const upload = multer ({storage});


// for post data
mongoose.connect(mongoURI, {
  userCreateIndex: true,
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

mongoose.connection.once("open", () => {
    console.log("DB connected");
    const changeSteam = mongoose.connection.collection("posts").watch();

    changeSteam.on("change", (change) => {
        console.log(change);

        if (change.operationType==="insert") {
            pusher.trigger("posts", "inserted", {
                change: change
              });
        }else{
            console.log("Error triggering Pusher");
        }
    })
    
})
// api routes
app.get("/", (req, res) => res.status(200).send("hello world"));

app.post("/upload/image", upload.single("file"), (req, res) => {
    res.status(201).send(req.file);
})

app.post("/upload/post", (req, res) => {
    const dbPost = req.body;
    mongoPosts.create(dbPost, (err, data) => {
        if (err) {
            res.status(500).send(err);
        }else{
            res.status(201).send(data)
        }
    })
})

app.get("/retrieve/posts", (req, res) => {
    mongoPosts.find((err, data) => {
        if (err) {
            res.status(500).send(err);
        }else {
            data.sort((a, b) => b.timestamp - a.timestamp);
            res.status(200).send(data);
        }
    })
});

app.get("/retrieve/images/single", (req, res) => {
    gfs.files.findOne({ filename: req.query.name }, (err, file) => {
        if (err) {
            res.status(500).send(err);
        }else {
            if (!file || file.length === 0) {
                res.status(404).json({err: "file not found"})
            } else {
                const readstream = gfs.createReadStream(file.filename);
                readstream.pipe(res);
            }
        }
    })
})

// listen
app.listen(port, () => {
  console.log(`listening on localhost: ${port}`);
});
