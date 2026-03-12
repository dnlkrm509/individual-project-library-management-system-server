const mongodb = require('mongodb');

const getDb = require('../util/database').getDb;

class Report {
    static fetch (status) {
        const db = getDb();
        if (status === 'all') {
            return db
            .collection('reports')
            .aggregate([
                { $sort: { returnedDate: -1 } }
            ])
            .toArray()
        } else if (status === 'returned') {
            return db
            .collection('reports')
            .aggregate([
                { $match: { returned: true } },
                { $sort: { returnedDate: -1 } }
            ])
            .toArray()
        } else {
            return db
            .collection('reports')
            .aggregate([
                { $match: { returned: false } },
                { $sort: { returnedDate: -1 } }
            ])
            .toArray()
        }
    }
}

module.exports = Report;