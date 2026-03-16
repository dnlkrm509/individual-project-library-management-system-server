const fs = require('fs');
const path = require('path');

const propertiesPath = require('properties-reader');
const { MongoClient, ServerApiVersion } = require('mongodb');


const propertiesPath = path.join(__dirname, '..', 'conf' , 'db.properties');
let config = {};

if (fs.existsSync(propertiesPath)) {
    // Local development
    const properties = propertiesReader(propertiesPath);

    config = {
        prefix: properties.get('db.prefix'),
        user: properties.get('db.user'),
        password: properties.get('db.psw'),
        dbName: properties.get('db.dbName'),
        dbUrl: properties.get('db.dbUrl'),
        params: properties.get('db.params')
    };

} else {
    // Production (Render)
    config = {
        prefix: process.env.DB_PREFIX,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        dbName: process.env.DB_NAME,
        dbUrl: process.env.DB_URL,
        params: process.env.DB_PARAMS
    };
}

const user = encodeURIComponent(config.user);
const password = encodeURIComponent(config.password);

const uri = config.prefix + user + ':' + password + config.dbUrl + config.params;

const client = new MongoClient(uri, { serverApi: ServerApiVersion.v1 });
let db;

async function connectToDatabase() {
    try {
        await client.connect();
        db = client.db(config.dbName);
        console.log('Connected to MongoDB!');
    } catch (err) {
        console.error('Cannot connect to MongoDB:', err);
    }
}

function getDb() {
    if (db) {
        return db;
    }
    throw 'No database found';
}

exports.getDB = getDb;
exports.connectToDatabase = connectToDatabase;