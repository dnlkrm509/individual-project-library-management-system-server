const mongodb = require('mongodb');

const getDb = require('../util/database').getDb;

class Reviews {
    static findByID (resourceId) {
        const db = getDb();
        return db
        .collection('reviews')
        .find({ itemId: new mongodb.ObjectId(resourceId) })
        .limit(10)
        .toArray()
    }
}

module.exports = Reviews;