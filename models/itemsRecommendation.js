const mongodb = require('mongodb');

const getDb = require('../util/database').getDb;

class ItemRecommendation {
    static async findByID(resourceId) {
      const db = getDb();

      return db.collection('items-recommendation')
        .aggregate([
          {
            $match: {
              itemId: new mongodb.ObjectId(resourceId)
            }
          },

          { $unwind: "$itemRecommendation" },

          {
            $lookup: {
              from: "items-recommendation",
              localField: "itemRecommendation.itemId",
              foreignField: "itemId", // MUST match exact field
              as: "recommendedDoc"
            }
          },

          { $unwind: "$recommendedDoc" },

          {
            $sort: {
              "itemRecommendation.score": -1,
              "recommendedDoc.confidence": -1
            }
          },

          { $limit: 10 },

          {
            $project: {
              _id: 0,
              itemId: "$itemRecommendation.itemId",
              score: "$itemRecommendation.score"
            }
          }
        ])
      .toArray();
    }
}

module.exports = ItemRecommendation;