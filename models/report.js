const mongodb = require('mongodb');

const getDb = require('../util/database').getDb;

class Report {
    static fetch (status) {
        const db = getDb();
        if (status === 'all') {
            return db
            .collection('reports')
            .find()
            .toArray()
        } else if (status === 'returned') {
            return db
            .collection('reports')
            .find({ returned: true })
            .toArray()
        } else {
            return db
            .collection('reports')
            .find({ returned: false })
            .toArray()
        }
    }
}

module.exports = Report;