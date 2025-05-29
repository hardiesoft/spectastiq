#!/bin/bash
# this requires rollup to be installed to create bundled versions of js files.
rollup spectastiq-worker.js --file worker-bundle.js --format iife
rollup main.js --file spectastiq.js --format iife
