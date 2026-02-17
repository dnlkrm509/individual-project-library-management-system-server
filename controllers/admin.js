const { validationResult } = require('express-validator');

const Resource = require('../models/resource');

exports.postAddResource = (req, res, next) => {
    const title = req.body.title;
    const author = req.body.author;
    const publicationYear = req.body.year;
    const genre = req.body.genre;
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(422).json({
            message: 'Validation failed.',
            errors: errors.array()
        });
    }

    const resource = new Resource(title, author, publicationYear, genre, null, req.user._id, true);
    resource.save()
    .then(result => {
        console.log('New Resource Created!');
        res.status(201).json({ message: 'Resource created successfully', resource: result });
    })
    .catch(err => {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
    });
};

exports.getResources = (req, res, next) => {
    let isAuthenticated = false;
    if (req.user) {
        isAuthenticated = !!req.user;
    }

    res.set("Cache-Control", "private, no-cache");
    res.set("Vary", "Authorization");
    
    Resource.findByUserId(req.user._id.toString())
    .then(resources => {
        res.json({
            pageTitle: 'Admin Resources',
            path: '/admin/resources',
            resources: resources,
            isAuthenticated
        })
    })
    .catch(err => {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
    });
};

exports.getResourceById = (req, res, next) => {
  const resourceId = req.params.resourceId;

  res.set("Cache-Control", "private, no-cache");
  res.set("Vary", "Authorization");

  Resource.findById(resourceId)
    .then(resource => {
      if (!resource) {
        return res.status(404).json({ message: 'Resource not found.' });
      }

      if (resource.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized.' });
      }

      res.status(200).json(resource);
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ message: 'Fetching resource failed.' });
    });
};


exports.putEditResource = (req, res, next) => {
    const resourceId = req.params.resourceId || req.query.resourceId;
    const title = req.body.title;
    const author = req.body.author;
    const publicationYear = req.body.year;
    const genre = req.body.genre;
    const availableStatus = req.body.availableStatus || true;
    const errors = validationResult(req);

     if (!errors.isEmpty()) {
        return res.status(422).json({
            message: 'Validation failed.',
            errors: errors.array()
        });
    }

    Resource.findById(resourceId)
    .then(resource => {
        if (!resource) {
            return res.status(404).json({ message: 'Resource not found.' });
        }

        if (resource.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized.' });
        }

        const newResource = new Resource(title, author, publicationYear, genre, resourceId, req.user._id, availableStatus);
        return newResource.save()
        .then(result => {
            console.log('updated resource');
            res.status(200).json({ message: 'Resource updated successfully', resource: result });
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        });
    })
    .catch(err => {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
    });
};

exports.deleteResource = (req, res, next) => {
    const resourceId = req.params.resourceId;
    Resource.deleteByResourceIdANDUserId(resourceId, req.user._id.toString())
    .then(resource => {
        console.log('Destroyed resource!')
        res.status(200).json({ message: 'Resource deleted.' });
    })
    .catch(err => {
        res.status(500).json({ message: 'Deleting resource failed.' });
    });
}