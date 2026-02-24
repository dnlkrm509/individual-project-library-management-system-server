const mongodb = require('mongodb');

const getDb = require('../util/database').getDb;

class ItemRecommendation {
    static findByID (recommendationResourceId) {
        const db = getDb();
        return db
        .collection('items-recommendation').findOne({_id: new mongodb.ObjectId(recommendationResourceId) })
    }
}

module.exports = ItemRecommendation;