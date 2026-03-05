const fs = require('fs');
const path = require('path');

const { InferenceClient } = require("@huggingface/inference");
const mongodb = require('mongodb');
const dotenv = require('dotenv');
dotenv.config();


const client = new InferenceClient(process.env.HF_API_KEY);
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const PDFDocument = require('pdfkit');


const getDb = require('../util/database').getDb;
const Resource = require('../models/resource');
const BorrowedHistory = require('../models/borrowedHistory');
const itemsRecommendation = require('../models/itemsRecommendation');
const Reviews = require('../models/reviews');

const ITEMS_PER_PAGE = 12;

exports.getFile = (req, res, next) => {
    const filename = req.params.filename;
    console.log(filename)
    const filePath = path.join(__dirname, '..', 'invoices', filename);
    
    fs.stat(filePath, (err, data) => {
        if (err) {
            const error = new Error('An error occured in file system: ' + err);
            error.statusCode = 404;
            return next(error);
        }

        if(data.isFile()) {
            res.sendFile(filePath);
        } else {
            const error = new Error('File not found');
            error.statusCode = 404;
            return next(error);
        }
    })
}

exports.getSearch = async (req, res, next) => {
    const searchText = req.query.search;
    const page = +req.query.page || 1;

    isAuthenticate = false;
    if (req.user) {
        isAuthenticate = !!req.user;
    }

    res.set("Cache-Control", "private, no-cache");
    res.set("Vary", "Authorization");
    // console.log(searchText)

    if (searchText) {
    //     // Perform search with query
        const searchNum = Number(searchText);
        let yearQuery = 0;

        if (!isNaN(searchNum)) {
            if (searchText.length === 4) {
                yearQuery = { publicationYear: searchNum };
            } else {
                const factor = Math.pow(10, 4 - searchText.length);
                const min = searchNum * factor;
                const max = min + factor - 1;

                yearQuery = { publicationYear: { $gte: min, $lte: max } };
            }
        }
        const query = {
            $or: [
                { title: { $regex: searchText, $options: 'i' } },
                { author: { $regex: searchText, $options: 'i' } },
                { genre: { $regex: searchText, $options: 'i' } },
                ...(isNaN(searchNum) ? [] : [
                    yearQuery,
                    { availableStatus: searchNum }])
            ]
        };
        Resource.fetchAllWithQuery(page, ITEMS_PER_PAGE, query)
    .then(resourceData => {
        res.status(200)
        .json({
            resources: resourceData.resources,
            loggedInUser: req.user,
            userId: req.userId,
            isAuthenticated: isAuthenticate,
            previousPage: page - 1,
            currentPage: page,
            nextPage: page + 1,
            lastPage: Math.ceil(resourceData.itemsCount / ITEMS_PER_PAGE),
            hasPreviousPage: page > 1,
            hasNextPage: (page * ITEMS_PER_PAGE) < resourceData.itemsCount
        });
    })
    .catch(err => {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
    });
    } else {
        Resource.fetchAll(page, ITEMS_PER_PAGE)
    .then(resourceData => {
        res.status(200)
        .json({
            resources: resourceData.resources,
            loggedInUser: req.user,
            userId: req.userId,
            isAuthenticated: isAuthenticate,
            previousPage: page - 1,
            currentPage: page,
            nextPage: page + 1,
            lastPage: Math.ceil(resourceData.itemsCount / ITEMS_PER_PAGE),
            hasPreviousPage: page > 1,
            hasNextPage: (page * ITEMS_PER_PAGE) < resourceData.itemsCount
        });
    })
    .catch(err => {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
    });
    }
}

exports.getResource = async (req, res, next) => {
    const resourceId = req.params.resourceId;
    let isAuthenticated = false;
    if (req.user) {
        isAuthenticated = !!req.user;
    }

    res.set("Cache-Control", "private, no-cache");
    res.set("Vary", "Authorization");

    try {
        const resource = await Resource.findById(resourceId)
        const reviews = await Reviews.findByID(resourceId);
        res.status(200).json({
            pageTitle: resource.title,
            path: '/resources',
            resource,
            reviews,
            loggedInUser: req.user,
            isAuthenticated
        })
    } catch (error) {
        const err = new Error(error);
        error.httpStatusCode = 500;
        return next(err);
    }
};

exports.getRecommendation = (req, res, next) => {
    const resourceId = req.params.resourceId;
    let isAuthenticated = false;
    if (req.user) {
        isAuthenticated = !!req.user;
    }

    res.set("Cache-Control", "private, no-cache");
    res.set("Vary", "Authorization");

    itemsRecommendation.findByID(resourceId)
    .then(resourceData => {
        const resourcePromise = resourceData.map(item => {
            return Resource.findById(item.itemId);
        });

        return Promise.all(resourcePromise)
    })
    .then(resource => {
        console.log(resource)
        res.status(200).json({
            pageTitle: 'Detail',
            path: '/detail',
            resource,
            loggedInUser: req.user,
            isAuthenticated
        })
    })
    .catch(err => {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
    });
};

exports.getBorrow = (req, res, next) => {
    let isAuthenticated = false;
    if (req.user) {
        isAuthenticated = !!req.user;
    }

    res.set("Cache-Control", "private, no-cache");
    res.set("Vary", "Authorization");
    
    req.user.getBorrowed()
    .then(resources => {
        res.status(200).json({
            pageTitle: 'Your Borrowed Resources',
            path: '/borrow',
            resources,
            loggedInUser: req.user,
            isAuthenticated
        })
    })
    .catch(err => {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
    });
};

exports.postBorrow = (req, res, next) => {
    const resourceId = req.body.resourceId;

    Resource.findById(resourceId)
    .then(resource => {
        return req.user.borrow(resource);
    })
    .then(result => {
        return res.json({ message: 'Resource borrowed successfully.' });
    })
    .catch(err => {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
    });
};

exports.postSentiment = async (req, res, next) => {
    const resourceId = req.params.resourceId;
    const rating = req.body.rating;
    const text = req.body.text;
    
    let response = {
        input: text,
        rating
    };
    
    const db = getDb();
    const itemId = new mongodb.ObjectId(resourceId);
    let newConfidence = null;
    console.log(response)
    
    try {
        const result = await client.textClassification({
            model: "cardiffnlp/twitter-roberta-base-sentiment-latest",
            inputs: text,
        });

        const label = result[0].label;
        const score = result[0].score;

        const isPositive = label === 'negative' ? -1 : 1;
        const sentimentValue = score * isPositive;

        response = {
            ...response,
            sentiment: {
                label,
                score,
                confidence: sentimentValue
            }
        };

        const item = await db.collection("items-recommendation").findOne({ itemId });

        const previousSum = item?.confidenceSum || 0;
        const previousCount = item?.reviewCount || 0;

        const newSum = previousSum + sentimentValue;
        const newCount = previousCount + 1;

        const newConfidence = newSum / newCount;

        await db.collection("items-recommendation").updateOne(
            { itemId },
            {
                $set: {
                    confidence: newConfidence,
                    confidenceSum: newSum,
                    reviewCount: newCount
                }
            }
        );
    } catch (error) {
        console.log("HuggingFace failed:", error.message);
    }

    try {
        await db.collection('reviews').insertOne({
            itemId,
            response,
            createdAt: new Date()
        });

        return res.json({ message: "Review saved", ...response, newConfidence });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

exports.getCheckout = (req, res, next) => {
    const resourceId = req.query.resourceId;
    const returned = req.query.returned;

    let selectedResource;
    let total = 0;
    
    req.user.getBorrowed()
    .then(resources => {
        selectedResource = resources.find(
            resource => resource._id.toString() === resourceId.toString()
        );
        console.log(selectedResource)
        if (!selectedResource) {
            throw new Error('Resource not found');
        }

        const returnedDate = new Date();
        const due = new Date(selectedResource.dueDate);

        const msPerDay = 1000 * 60 * 60 * 24;
        const lateDays = Math.ceil((returnedDate - due) / msPerDay);

        if (lateDays > 0) {
            total = lateDays * 1.99;
        }

        return stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'gbp',
                    product_data: {
                        name: selectedResource.title,
                        description: selectedResource.author + ", " + selectedResource.publicationYear
                    },
                    unit_amount: Math.round(total * 100)
                },
                quantity: 1
            }],
            mode: 'payment',
            success_url: `${req.get('origin')}/individual-project-library-management-system-client/shop/checkout-success.html?resourceId=${resourceId}&returned=${returned}`,
            cancel_url: `${req.get('origin')}/individual-project-library-management-system-client/shop/borrow.html`
        });
    })
    .then(session => {
        res.json({
            pageTitle: 'Checkout',
            path: '/checkout',
            resource: selectedResource,
            total,
            sessionId: session.id
        });
    })
    .catch(err => {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
    });
};

exports.getCheckoutSuccess = (req, res, next) => {
    const resourceId = req.query.resourceId;
    const returned = req.query.returned;

    console.log(req.user)

    Resource.findById(resourceId)
    .then(resource => {
        return req.user.borrow(resource);
    })
    .then(result => {
        return res.json({ message: 'Resource returned successfully' });
    })
    .catch(err => {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
    });
};

exports.getBorrowedHistory = (req, res, next) => {
    let isAuthenticated = false;
    if (req.user) {
        isAuthenticated = !!req.user;
    }

    res.set("Cache-Control", "private, no-cache");
    res.set("Vary", "Authorization");
    
    req.user.getBorrowedHistory()
    .then(returneds => {
        res.json({
            pageTitle: 'Your Borrowed Resources History',
            path: '/borrow-history',
            returneds,
            loggedInUser: req.user,
            isAuthenticated
        })
    })
    .catch(err => {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
    });
};

exports.getInvoice = (req, res, next) => {
    const borrowHistoryId = req.params.borrowHistoryId;
    BorrowedHistory.findByID(borrowHistoryId)
    .then(BH => {
        if (!BH) {
            return next(new Error('No resource found.'));
        }
        if (BH.user._id.toString() !== req.user._id.toString()) {
            return next(new Error('Unauthorized'));
        }

        const invoiceName = 'invoice-' + borrowHistoryId + '.pdf';
        const invoicePath = path.join('invoices', invoiceName);
    
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="' + invoiceName + '"');
        const pdfDoc = new PDFDocument({ margin: 50 });
        pdfDoc.pipe(res);
        pdfDoc.pipe(fs.createWriteStream(invoicePath));


        // 📄 Write multiple lines into the PDF
        pdfDoc.fontSize(20).text('Invoice', { underline: true });
        pdfDoc.moveDown();

        pdfDoc.fontSize(14).text(`Borrowed History ID: ${borrowHistoryId}`);
        pdfDoc.text(`Customer Email Address: ${BH.user.email || 'Unknown'}`);
        pdfDoc.moveDown();

        pdfDoc.text('Items:', { underline: true });
        pdfDoc.moveDown(0.5);

        // Loop through products and render each with image and details    
        // Product listing
        BH.resources.forEach(p => {
            const boxX = pdfDoc.x;
            const boxY = pdfDoc.y;
            const boxWidth = pdfDoc.page.width - pdfDoc.page.margins.left - pdfDoc.page.margins.right;
            const boxHeight = 130;

            // Simulate shadow with a slightly offset gray rectangle
            pdfDoc
                .save()
                .fillColor('#cccccc')
                .rect(boxX + 3, boxY + 3, boxWidth, boxHeight)
                .fill()
                .restore();

            // Draw main white box with border
            pdfDoc
                .save()
                .fillColor('#ffdfff')
                .strokeColor('#999999')
                .lineWidth(1)
                .rect(boxX, boxY, boxWidth, boxHeight)
                .fillAndStroke()
                .restore();

            // Text inside box
            const textX = boxX + 10;
            const textY = boxY + 10;

            pdfDoc.fillColor('black').fontSize(12).text(
                `Title: ${p.title}`,
                textX,
                textY,
                {
                width: boxWidth - 120,
                continued: false
                }
            );

            pdfDoc.fillColor('black').fontSize(12).text(
                `Author: ${p.author}`,
                textX,
                textY + 15,
                {
                width: boxWidth - 120,
                continued: false
                }
            );

            pdfDoc.fillColor('black').fontSize(12).text(
                `Punlication Year: ${p.publicationYear}`,
                textX,
                textY + 30,
                {
                width: boxWidth - 120,
                continued: false
                }
            );

            pdfDoc.fillColor('black').fontSize(12).text(
                `Genre: ${p.genre}`,
                textX,
                textY + 45,
                {
                width: boxWidth - 120,
                continued: false
                }
            );

            pdfDoc.fillColor('black').fontSize(12).text(
                `Due Date: ${p.dueDate}`,
                textX,
                textY + 60,
                {
                width: boxWidth - 120,
                continued: false
                }
            );

            pdfDoc.fillColor('black').fontSize(12).text(
                `Returned Date: ${p.returnedDate}`,
                textX,
                textY + 75,
                {
                width: boxWidth - 120,
                continued: false
                }
            );

            // Image inside box (to the right of the text)
            if (p.imageUrl) {
                try {
                pdfDoc.image(p.product.imageUrl, boxX + boxWidth - 170, boxY + 5, {
                    fit: [150, 150]
                });
                } catch (err) {
                pdfDoc.fontSize(10).fillColor('red').text('[Image missing]', boxX + boxWidth - 90, boxY + 30);
                }
            }

            
            pdfDoc.moveDown(2);
            pdfDoc.text('-------------');
            pdfDoc.text('Charge per day after due date: £1.99');
            
            const returned = new Date(p.returnedDate);
            const due = new Date(p.dueDate);

            const msPerDay = 1000 * 60 * 60 * 24;
            const lateDays = Math.ceil((returned - due) / msPerDay);

            const charge = lateDays > 0 ? (lateDays * 1.99) : 0;

            pdfDoc.text(`Total Price: £${charge.toFixed(2)}`, {
                bold: true
            });
            
            // Move below box
            pdfDoc.moveDown(6);
            pdfDoc.y = boxY + boxHeight + 10; // manually advance position
        });

        pdfDoc.end();

    })
    .catch(err => {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
    });
};