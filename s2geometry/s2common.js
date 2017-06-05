/**
 * Created by tinyiko on 2017/04/23.
 */
"use strict";

var lineReader = require('line-reader');
var Promise = require("bluebird");
var s2 = require("nodes2ts");
var constants = require("../constants");
var logger = require("../config/logutil").logger;

var s2common = (function(){

    var i = 0;
    var line_counter = 0;
    var unreached = [];
    var node_array2 = [];
    var node_array = [];

    function s2common(){
    };

    var gpsPoint = function(lat,lon,isDepart,name){
        this.latitude = lat;
        this.longitude = lon;
        this.isDepart = isDepart;
        this.name = name;
        this.distance = 0;
    }

    s2common.toRad = function(degrees){
        var radians = degrees * Math.PI/180;
        return radians;
    }

    if(typeof(Number.prototype.toRad) === "undefined") {
        Number.prototype.toRad = function () {
            return this * Math.PI / 180;
        }
    }

    s2common.EarthMetersToRadians = function(meters) {
        return (2 * Math.PI) * (meters /constants.KEARTH_CIRCUMFERENCE_METERS);
    };

    s2common.distanceCalc = function(start, end, decimals){
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

    /**
     * Method to read each line in file and convert into GPS Point object (lat,lon)
     * @param resolve
     * @param reject
     * @returns {a promise}
     */
    s2common.readDrivers = function(filename) {
        var readLine = Promise.promisify(lineReader.eachLine);
        var promise = new Promise(function(resolve,reject){
            readLine(filename, function (line, last) {
                var line_str = line.split(",");
                unreached[line_counter] = new gpsPoint(line_str[0], line_str[1], line_str[2], line_str[3]);
                line_counter++;
                if (last) {
                    // or check if it's the last one
                    console.log("last item = " + last + "=" + line_counter);
                }
            }).then(function(results){
                //console.log("readline results :"+results);
                resolve(unreached);
            }).catch(function(error){
                reject(error.toString());
            });
        });
        return promise;
    }

    /**
     * retrieve array of parent IDs at level 12 - 14 for given leaf-id, where start-index
     * is the minimum level and no_of_levels is quantity of levels to maximum level
     * @param leaf_id
     * @param start_index
     * @param no_of_levels
     * @returns {null}
     */

    s2common.getParentIdArray = function(leaf_id, start_index, no_of_levels){
        var s2cell = new s2.S2CellId(leaf_id);
        if(s2cell.isValid() == false) throw Error("Invalid cell id = "+leaf_id);
        var parentCellsArray = new Array();

        var index_total = start_index + no_of_levels;
        var cell_level = s2cell.level();

        if(index_total < cell_level){
            var total = start_index + no_of_levels;
            for(var i = start_index; i < total; i++){
                var parent12 = s2cell.parentL(i);
                parentCellsArray.push(parent12);
            }
        }
        else{
            throw Error("Cant get parent at level="+index_total +
                " for a cell:" + leaf_id + " at level="+cell_level+"");
        }
        return parentCellsArray;
    }

    /**
     * get 4 children (quad-cells) from a given cell-id that is not a leaf
     * @param cell_id
     * @returns {Array}
     */
    s2common.getChildrenCellIds = function(cell_id){
        /*if(isNaN(cell_id)){
            throw new Error("key not integer string  e.g.'2203794985692692496'");
        }*/
        var s2cell_id = new s2.S2CellId(cell_id);
        if(s2cell_id.isValid() == false) throw Error("Invalid cell id = "+cell_id);
        if(s2cell_id.isLeaf() == false) {
            return new s2.S2Cell(s2cell_id).subdivide();
        }
        return null;
    }

    s2common.getFirstLeafCellOfBranch = function(parent){
        if(parent.isLeaf() == true) return;
        //var s2cell_centre = null;
        while(i < 18){
            var s2cell_centre = parent.subdivide()[0];
            console.log(s2cell_centre + "=" + s2cell_centre.id.id +"="+i);
            i++;
            node_array.push(s2cell_centre);
            getFirstLeafCellOfBranch(s2cell_centre);
        }
        return node_array;
    }

    s2common.getLastLeafCellOfBranch = function(parent){
        if(parent.isLeaf() == true) return;
        while(count < 18){
            var s2cell_centre = parent.subdivide()[3];
            console.log(s2cell_centre + "=" + s2cell_centre.id.id +"="+count);
            count++;
            node_array2.push(s2cell_centre);
            getLastLeafCellOfBranch(s2cell_centre);
        }
        return node_array2;
    }

    /**
     * Returns a position of the cell center along the Hilbert curve
     * from given two latitude and longitude doubles
     * @param lat
     * @param lon
     * @returns {string}
     */
    s2common.s2CellIDfromLatLng = function(lat,lon){
        if(isNaN(lat) || isNaN(lon)){
            throw new Error("latitude and longitude must be double values");
        }
        var s2_latlng = new s2.S2LatLng.fromDegrees(lat,lon);
        var s2_point = s2_latlng.toPoint();
        var s2_cellid = new s2.S2CellId.fromPoint(s2_point);

        //logger.debug(s2_cellid.toToken());
        return s2_cellid;
    }

    s2common.s2CellIdKeyFromLatLng = function(lat,lon){
        return s2common.s2CellIDfromLatLng(lat,lon).pos().toString();
    }
    /**
     * Returns a S2Cell object from a latlng
     * @param lat
     * @param lon
     * @returns {S2Cell}
     */
    s2common.s2CellfromLatLng = function(lat,lon){
        if(isNaN(lat) || isNaN(lon)){
            throw new Error("latitude and longitude must be double values");
        }
        var s2_latlng = s2.S2LatLng.fromDegrees(lat,lon);
        var s2cell = new s2.S2Cell.fromLatLng(s2_latlng);
        return s2cell;
    }

    /**
     * given a level and leaf id, this function returns id of parent
     * @param level
     * @param leaf_id
     */
    s2common.getParentIdAtLevel = function(level,leaf_id){
        if(level > 30 || level < 1){
            throw Error("level out of bounds, should be between 1 - 30");
        }
        var s2cell = new s2.S2CellId(leaf_id);
        if(s2cell.isValid() == false) throw Error("Invalid cell id = "+leaf_id);
        if(s2cell.level() > level){
            var parent_s2cell = s2cell.parentL(level);
            return parent_s2cell.id.toString();
        }
        else{
            throw Error("parent level must be less than " +s2cell.level() +
                ", current level = "+level);
        }
    }

    s2common.getVertexArrayfromCells = function(cells){
        console.log("--------------cellArray ----------------");
        var totalVertexArray = [];
        cells.forEach(function(one_cell,index){
            var vertex = [];
            var s2cell = new s2.S2Cell(new s2.S2CellId(one_cell));//new s2.S2Cell(one_cell)
            for(var i = 0; i < 4; i++){
                var latlng = new s2.S2LatLng.fromPoint(s2cell.getVertex(i));
                logger.log("cell, i="+ i +"(" + latlng.lngDegrees.toNumber() +","+latlng.latDegrees.toNumber()+")");
                vertex.push(latlng.lngDegrees.toNumber() +","+latlng.latDegrees.toNumber());
            }
            var latlng = new s2.S2LatLng.fromPoint(s2cell.getVertex(0));
            logger.log("cell, i="+ i +"(" + latlng.lngDegrees.toNumber() +","+latlng.latDegrees.toNumber()+")");
            vertex.push(latlng.lngDegrees.toNumber() +","+latlng.latDegrees.toNumber());
            console.log("--------------cellArray ----------------" + vertex[index]);
            totalVertexArray.push(vertex);
        });

        return totalVertexArray;
    }

    /***
     * Method returns an intersection set for two cellId Arrays
     * @param s2cellIds_A
     * @param s2cellIds_B
     * @returns {S2CellUnion}
     */
    s2common.getCellIntersection = function(cellIdArray_A, cellIdArray_B){
        //var intersectArray = new Array();
        var unionOne = new s2.S2CellUnion();
        var unionTwo = new s2.S2CellUnion();
        var intersection = new s2.S2CellUnion();

        if(cellIdArray_A.length > 0 && cellIdArray_B.length > 0){

            unionOne.initFromIds(cellIdArray_A);
            unionTwo.initFromIds(cellIdArray_B);
            intersection.getIntersectionUU(unionOne,unionTwo);

            var cells = intersection.getCellIds();
        }
        return cells;
        //return intersectArray;
    };

    s2common.getDriversFromFile2 = function(cb){
        var promises = [];
        var filename = '/Users/tinyiko/WebstormProjects/GoSwift/server/config/seeds/Gps_dump3.csv';
        s2common.readDrivers(filename).then(function(data){

            data.forEach(function(each_driver) {
                var lat = each_driver.latitude;
                var lon = each_driver.longitude;
                var s2cell_id = s2common.s2CellIDfromLatLng(lat,lon);
                promises.push(s2cell_id.pos());
            });
            cb(promises);
            //return promises;
        }).catch(function(error){
            console.log("Error logged : " +error);
        });
        //return promises;
    }

    s2common.addDriversFromFile = function(){
        var filename = '/Users/tinyiko/WebstormProjects/GoSwift/server/config/seeds/Gps_dump3.csv';
        s2common.readDrivers(filename).then(function(data){
            data.forEach(function(each_driver) {
                var lat = each_driver.latitude;
                var lon = each_driver.longitude;
                var s2cell_id = s2common.s2CellIDfromLatLng(lat,lon);
               // logger.log("cell_id = " + s2cell_id.id + "["+lat+","+lon + "]="+sandton.contains(s2cell_id));
                //console.log(s2cell_id.id.toString());
            });
        }).catch(function(error){
            console.log("Error logged : " +error);
        });
    }

    return s2common;
}).call(this);


exports.s2common = s2common;

//s2common.addDriversFromFile();//-26.270155, 28.438425
var id = s2common.s2CellIDfromLatLng(-26.270155, 28.438425);
var parent = s2common.getParentIdAtLevel(29,id.pos());
var s2id = new s2.S2CellId(parent);
//logger.log(s2id.isValid() + "-"+s2id);
//var parentArray = s2common.getParentIdArray(id.pos(),26,3);
//logger.log(parentArray);
//var children = s2common.getChildrenCellIds("2203793418029629440");
