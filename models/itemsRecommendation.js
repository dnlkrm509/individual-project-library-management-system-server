const mongodb = require('mongodb');

const getDb = require('../util/database').getDb;

class ItemRecommendation {
    static findByID (resourceId) {
        const db = getDb();
        return db
        .collection('items-recommendation')
        .find({ itemId: new mongodb.ObjectId(resourceId) })
        .sort({ 
            "itemRecommendation.score": -1,
            confidence: -1
        })
        .limit(10)
        .toArray()
    }
}

module.exports = ItemRecommendation;