const getDb = require('../util/database').getDb;

class ItemRecommendation {
    static findByID () {
        const db = getDb();
        return db
        .collection('items-recommendation').find({})
        .sort({ score: -1 })
        .limit(10)
        .toArray()
    }
}

module.exports = ItemRecommendation;