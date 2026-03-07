const mongodb = require('mongodb');

const getDb = require('../util/database').getDb;

class User {
    constructor(email, password, role, borrowedItems, userId, resetToken, resetTokenExpiration) {
        this.email = email;
        this.password = password;
        this.role = role;
        this.borrowedItems = borrowedItems ? borrowedItems : { resources: [] }; // { resources: [] }
        this._id = userId ? new mongodb.ObjectId(userId) : null;
        this.resetToken = resetToken;
        this.resetTokenExpiration = resetTokenExpiration;
    }

    save() {
        const db = getDb();
        let dbOp;

        if (this._id) {
            dbOp = db.collection('users').updateOne(
                { _id: this._id },
                { $set: this }
            )
        } else {
            dbOp = db.collection('users').insertOne(this)
        }
        return dbOp
        .then(result => console.log(result))
        .catch(err => console.log(err))
    }

    borrow(resource) {
        const borrowedResourceIntex = this.borrowedItems.resources.findIndex(BR => {
            return BR.resourceId.toString() === resource._id.toString();
        });
        let availableStatus = resource.availableStatus;
        let updatedBorrowedResources = [ ...this.borrowedItems.resources ];
        
        if (borrowedResourceIntex >= 0) {
            // Return the existing resource

            availableStatus = !availableStatus;
            updatedBorrowedResources = updatedBorrowedResources.filter(UBR => {
                return UBR.resourceId.toString() !== resource._id.toString();
            })

            this.#borrowedHistory(resource._id);
        } else {
            // Borrow as a new borrowed resource

            availableStatus = !availableStatus;
            const currentDate = new Date();
            const futureDate = new Date();
            futureDate.setDate(currentDate.getDate() + 10);

            updatedBorrowedResources.push({
                resourceId: new mongodb.ObjectId(resource._id), dueDate: futureDate
            });
        }

        const updatedBorrowed = {
            resources: updatedBorrowedResources
        };

        const db = getDb();
        db
        .collection('resources')
        .updateOne(
            { _id: resource._id },
            { $set: { availableStatus: availableStatus } }
        )
        return db
        .collection('users')
        .updateOne(
            
            { _id: new mongodb.ObjectId(this._id) },
            { $set: { borrowedItems: updatedBorrowed } }
        )
    }

    getBorrowed() {
        const db = getDb();
        const borrowedResourceIds = this.borrowedItems.resources.map(BR => {
            return BR.resourceId;
        });

        
        return db
        .collection('resources')
        .find({ _id: { $in: borrowedResourceIds } })
        .toArray()
        .then(resources => {
            return resources.map(resource => {
                return {
                    ...resource,
                    dueDate: this.borrowedItems.resources.find(BR => {
                        return BR.resourceId.toString() === resource._id.toString();
                    }).dueDate
                }
            })
        })
        .catch(err => console.log(err))
    }
    
    #borrowedHistory(resourceId) {
        const db = getDb();
        return this.getBorrowed()
        .then(borrowedResources => {
            let updatedBorrowedResources = borrowedResources.map(BR => {
                if (BR._id.toString() === resourceId.toString()) {
                    return {
                        ...BR,
                        returnedDate: new Date()
                    }
                }
            });

            updatedBorrowedResources = updatedBorrowedResources.filter(UBR => {
                return !!UBR;
            });

            const borrowedHistory = {
                resources: updatedBorrowedResources,
                user: {
                    _id: new mongodb.ObjectId(this._id),
                    email: this.email
                }
            };
            
            return db.collection('borrowed-history').insertOne(borrowedHistory)
            .then(result => {
                async function updateRecommendation(resourceId, borrowedHistoryIds) {
                    const recommendationCollection = db.collection('items-recommendation');

                    for (const RID of borrowedHistoryIds) {
                        if (RID.toString() === resourceId.toString()) continue;

                        const isRIDExists = await recommendationCollection.findOne({ itemId: RID });
                        if(isRIDExists) {
                            // Check if the recommendation already exists in array
                            const existingRecommendation = isRIDExists.itemRecommendation?.find(
                                rec => rec.itemId.toString() === resourceId.toString()
                            );

                            if (existingRecommendation) {
                                // Increment score
                                await recommendationCollection.updateOne(
                                    { itemId: RID, "itemRecommendation.itemId": resourceId },
                                    { $inc: { "itemRecommendation.$.score": 1 } }
                                );
                            } else {
                                // Add new recommendation
                                await recommendationCollection.updateOne(
                                    { itemId: RID },
                                    { $push: { itemRecommendation: { itemId: resourceId, score: 1 } } }
                                );
                            }
                        } else {
                            // If recommendation does not exist yet, push it
                            await recommendationCollection.insertOne({
                                itemId: RID,
                                itemRecommendation: [
                                    { itemId: resourceId, score: 1 }
                                ]
                            })
                        }

                        const isResourceExists = await recommendationCollection.findOne({ itemId: resourceId });
                        if(isResourceExists) {
                            // Check if the recommendation already exists in array
                            const existingRecommendation = isResourceExists.itemRecommendation?.find(
                                rec => rec.itemId.toString() === RID.toString()
                            );

                            if (existingRecommendation) {
                                // Increment score
                                await recommendationCollection.updateOne(
                                    { itemId: resourceId, "itemRecommendation.itemId": RID },
                                    { $inc: { "itemRecommendation.$.score": 1 } }
                                );
                            } else {
                                // Add new recommendation
                                await recommendationCollection.updateOne(
                                    { itemId: resourceId },
                                    { $push: { itemRecommendation: { itemId: RID, score: 1 } } }
                                );
                            }
                        } else {
                            // If recommendation does not exist yet, push it
                            await recommendationCollection.insertOne({
                                itemId: resourceId,
                                itemRecommendation: [
                                    { itemId: RID, score: 1 }
                                ]
                            });
                        }
                    }
                }
                return this.getBorrowedHistory()
                .then(borrowedHistoryList => {
                    const borrowedHistoryIds = borrowedHistoryList
                    .flatMap(history => history.resources || [])
                    .map(resource => resource._id);

                    console.log(borrowedHistoryIds)

                    return updateRecommendation(resourceId, borrowedHistoryIds);                    
                })
            })
        })
        .catch(err => console.log(err))
    }    

    getBorrowedHistory() {
        const db = getDb();
        return db
        .collection('borrowed-history')
        .find({ 'user._id': new mongodb.ObjectId(this._id) })
        .sort({ 'resources.returnedDate': -1 })
        .toArray();
    }

    static findById(userId) {
        const db = getDb();
        return db.collection('users').findOne({_id : new mongodb.ObjectId(userId)});
    }

    static findByEmail(email) {
        const db = getDb();
        return db.collection('users').findOne({email : email});
    }

    static findByPasswordToken(token) {
        const db = getDb();
        return db.collection('users').findOne({
            resetToken : token,
            resetTokenExpiration: { $gt: Date.now() }
        })
    }

    static findByUserIdANDToken(userId, token) {
        const db = getDb();
        return db.collection('users')
        .findOne({
            _id: new mongodb.ObjectId(userId),
            resetToken : token,
            resetTokenExpiration: { $gt: Date.now() }
        });
    }

}

module.exports = User;