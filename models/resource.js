const mongodb = require('mongodb');

const getDb = require('../util/database').getDb;

class Resource {
    constructor(title, author, publicationYear, genre, resourceId, userId, availableStatus) {
        this.title = title;
        this.author = author;
        this.publicationYear = publicationYear;
        this.genre = genre;
        this._id = resourceId ? new mongodb.ObjectId(resourceId) : null;
        this.userId = userId;
        this.availableStatus = availableStatus;
    }

    save() {
        const db = getDb();
        let dbOp;

        if (this._id) {
            if (this.availableStatus === 'true') {
                this.availableStatus = true;
            } else if (this.availableStatus === 'false') {
                this.availableStatus = false;
            }
            dbOp = db.collection('resources').updateOne(
                { _id: this._id },
                { $set: this }
            )
        } else {
            dbOp = db.collection('resources').insertOne(this)
        }
        return dbOp
        .then(result => console.log(result))
        .catch(err => console.log(err))
    }

    static findById(resourceId) {
        const db = getDb();
        return db
        .collection('resources')
        .findOne({ _id: new mongodb.ObjectId(resourceId) })
        .then(resource => resource)
        .catch(err => console.log(err))
    }

    static findByUserId(userId) {
        const db = getDb();
        return db
        .collection('resources')
        .find({ userId: new mongodb.ObjectId(userId) })
        .toArray()
        .then(resource => resource)
        .catch(err => console.log(err))
    }

    static fetchAll(page, itemsPerPage) {
        const db = getDb();
        return Promise.all([
            db.collection('resources').countDocuments(),
            db.collection('resources')
            .aggregate([
                {
                    $lookup: {
                        from: "reviews",
                        localField: "_id",
                        foreignField: "itemId",
                        as: "reviews"
                    }
                },
                {
                    $unwind: {
                        path: "$reviews",
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $addFields: {
                        hasReviewText: {
                            $cond: [
                                { $and: [
                                    { $ne: ["$reviews.response.input", ""] },
                                    { $ne: ["$reviews.response.input", null] }
                                ]},
                                1,
                                0
                            ]
                        },
                        numericRating: {
                            $toInt: { $ifNull: ["$reviews.response.rating", "-1"] }
                        },
                        confidence: {
                            $ifNull: ["$reviews.response.sentiment.confidence", -1]
                        }
                    }
                },
                {
                    $sort: {
                        
                        numericRating: -1,
                        confidence: -1
                    }
                },
                {
                    $group: {
                        _id: "$_id",
                        resource: { $first: "$$ROOT" }
                    }
                },
                {
                    $replaceRoot: { newRoot: "$resource" }
                },
                {
                    $sort: {
                        
                        numericRating: -1,
                        confidence: -1
                    }
                }
            ])
            .skip((page - 1) * itemsPerPage)
            .limit(itemsPerPage)
            .toArray()
        ])
        .then(([itemsCount, resources]) => {
            return { resources, itemsCount }
        })
        .catch(err => console.log(err))
    }


    static fetchAllWithQuery(page, itemsPerPage, query) {
        const db = getDb();
        return Promise.all([
            db.collection('resources').countDocuments(query),
            db.collection('resources')
            .aggregate([
                {
                    $match: query
                },
                {
                    $lookup: {
                        from: "reviews",
                        localField: "_id",
                        foreignField: "itemId",
                        as: "reviews"
                    }
                },
                {
                    $unwind: {
                        path: "$reviews",
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $addFields: {
                        hasReviewText: {
                            $cond: [
                                { $and: [
                                    { $ne: ["$reviews.response.input", ""] },
                                    { $ne: ["$reviews.response.input", null] }
                                ]},
                                1,
                                0
                            ]
                        },
                        numericRating: {
                            $toInt: { $ifNull: ["$reviews.response.rating", "-1"] }
                        },
                        confidence: {
                            $ifNull: ["$reviews.response.sentiment.confidence", -1]
                        }
                    }
                },
                {
                    $sort: {
                        hasReviewText: -1,
                        numericRating: -1,
                        confidence: -1
                    }
                },
                {
                    $group: {
                        _id: "$_id",
                        resource: { $first: "$$ROOT" }
                    }
                },
                {
                    $replaceRoot: { newRoot: "$resource" }
                },
                {
                    $sort: {
                        hasReviewText: -1,
                        numericRating: -1,
                        confidence: -1
                    }
                }
            ])
            .skip((page - 1) * itemsPerPage)
            .limit(itemsPerPage)
            .toArray()
        ])
        .then(([ itemsCount, resources]) => {
            return { resources, itemsCount }
        })
        .catch(err => console.log(err))
    }

    static deleteByResourceIdANDUserId(resourceId, userId) {
        const db = getDb();
        return db
        .collection('resources')
        .deleteOne({
            _id: new mongodb.ObjectId(resourceId),
            userId: new mongodb.ObjectId(userId)
        })
    }
}

module.exports = Resource;