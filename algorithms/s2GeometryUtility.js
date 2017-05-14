/**
 * Created by tinyiko on 2017/04/09.
 */

"use strict";

var s2 = require('s2geometry-node');
var _ = require('underscore');

var earth_radius = 1000 * 6378.1; // (km = 6378.1) - radius of the earth
var default_dispatch_radius = 31885;    //meters
var kEarthCircumferenceMeters = 1000 * 40075.017;

function EarthMetersToRadians(meters) {
    return (2 * Math.PI) * (meters / kEarthCircumferenceMeters);
}

var distanceCalc = function(start, end, decimals){
    decimals = decimals || 2;
    var earthRadius = 6371; // km
    //console.log("GPS=latitude distanceCalc = " + start + "|" + end);
    lat1 = parseFloat(start.latitude);
    lat2 = parseFloat(end.latitude);
    var lon1 = parseFloat(start.longitude);
    var lon2 = parseFloat(end.longitude);

    var dLat = (lat2 - lat1).toRad();
    var dLon = (lon2 - lon1).toRad();
    var lat1 = lat1.toRad();
    var lat2 = lat2.toRad();

    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = earthRadius * c;
    //Math.round(d,6);
    return Math.round(d * Math.pow(10, decimals)) / Math.pow(10, decimals);

}

function toRad(gps_point){
    return gps_point * Math.PI / 180;
}

/*function toRadiansGPS(lat,lon){
    return toRad(lat)
}*/
exports.distanceCalc = distanceCalc;
exports.EarthMetersToRadians = EarthMetersToRadians;