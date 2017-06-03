/**
 * Created by tinyiko on 2017/05/30.
 */
var _ = require("lodash");
var client = require("../redis/redisProvider").provider;
var lineReader = require('line-reader');
var Promise = require("bluebird");
var logger = require("../config/logutil").logger;
var s2common = require("../s2geometry/s2common").s2common;
var _score = require("underscore");
var s2 = require("nodes2ts");

var tripCreator = (function () {
    var that;
    var line_counter = 0;
    var unreached = [];

    function tripCreator() {
        that = this;
        console.log("created object : " + JSON.stringify(that));
    };

    var gpsPoint = function (lat, lon) {
        this.latitude = lat;
        this.longitude = lon;
    }
    /**
     * Method to read each line in file and convert into GPS Point object (lat,lon)
     * @param resolve
     * @param reject
     * @returns {a promise}
     */
    tripCreator.readDriversGPS = function (filename) {
        var readLine = Promise.promisify(lineReader.eachLine);
        var promise = new Promise(function (resolve, reject) {
            readLine(filename, function (line, last) {
                var line_str = line.split(",");
                unreached[line_counter] = new gpsPoint(line_str[0], line_str[1]);
                line_counter++;
                if (last) {
                    // or check if it's the last one
                    console.log("last item = " + last + "=" + line_counter);
                }
            }).then(function (results) {
                //console.log("readline results :"+results);
                resolve(unreached);
            }).catch(function (error) {
                reject(error.toString());
            });
        });
        return promise;
    }

    tripCreator.readDrivers = function (filename) {
        var stringArray = [];
        var readLine = Promise.promisify(lineReader.eachLine);
        var promise = new Promise(function (resolve, reject) {
            readLine(filename, function (line, last) {
                var line_str = line.split(",");
                logger.log("split = " + line_str.length);
                stringArray = line_str;
            }).then(function(results) {
                resolve(stringArray);
            })
        })
        return promise;
    }

    tripCreator.readCellsInHex = function(){
        var filename = '/Users/tinyiko/WebstormProjects/GoSwift/docs/S2/routes/cells_in_hex.txt';
        tripCreator.readDrivers(filename).then(function (data) {

            data.forEach(function(item){
                //logger.log(item);
                var cellId = new s2.S2CellId.fromToken(item);
                console.log(cellId.id+"");
            })
        });
    }

    tripCreator.logVehicleTrip = function (vehicle_id) {
        var filename = '/Users/tinyiko/WebstormProjects/GoSwift/docs/S2/routes/Paulshof_waypoints.txt';
        //Paulshof_waypoints.txt,Springs_edge_waypoints.txt,Woodmead_waypoints,Taxi_locations_grid

        var id = parseInt(vehicle_id);

        tripCreator.readDriversGPS(filename).then(function (data) {

            data.forEach(function (each_driver) {
                var lat = _.trim(each_driver.latitude);
                var lon = _.trim(each_driver.longitude);
                var s2cell_id = s2common.s2CellIdKeyFromLatLng(lat, lon);
                var tstamp = new Date().getTime();
                id++;
                client.addVehiclePosition(s2cell_id, id, tstamp).then(function (results) {
                    //logger.log("...."+s2cell_id + ",with timestamp = "+ tstamp + ".results = "+results);
                }).catch(function (error) {
                    logger.error("vehicle not added " + error);
                });

            });
            //cb(promises);
            //return promises;
        }).catch(function (error) {
            console.log("Error logged : " + error);
            return false;
        });
    }

    tripCreator.prototype.print = function (msg) {
        console.log(" print message from = " + JSON.stringify(this === that) + "/" + msg);
        //coord.coordinates[i].lat + "," + coord.coordinates[i].lng;
        //trip[i].lat + "," + trip[i].lng;
        var trip = '{"gps": [' +
            '{ "lat":"-122.420017", "lng":"37.780096" },' +
            '{ "lat":"-122.420017", "lng":"37.780096" },' +
            '{ "lat":"-122.420017", "lng":"37.780096" },' +
            '{ "lat":"-122.420017", "lng":"37.780096" }' +
            ']}';

        var trips = JSON.parse(trip);
        //console.log(trips);
        trips.gps.forEach(function (item, index) {
            console.log("gps# " + index + "-" + JSON.stringify(item));
        });
    }

    return tripCreator;

}).call(this);

exports.tripRequest = tripCreator;

//new tripCreator().print("trip to sandton");

tripCreator.logVehicleTrip("004467");
//tripCreator.readCellsInHex();