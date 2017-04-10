/**
 * Created by tinyiko on 2017/03/28.
 */
/*
* minimum spanning tree (MST) best implementation to solve this problem
* kruskal algorithm or prims algorithm. calculating the cost is the main challenge
* constraints = tree must not be more than 3 nodes, cost of whole span not greater
* than cost of sum(individual spans) * 1.4?
*
* Should possibly use a set of trees (i.e. forest) instead of a single tree
* given N nodes, the should be N-1 edges at most we must be able to get from one Node to any
* other Node in the set of trees. We must be able to span at most 3 edges that represent trips.
* Should all nodes be disjointed (including edges to connect another trip, then we should span node+2)
*
* Assumptions :-
* - there is a car always at each trip vertex
* - not more than 3 real paths (actual trips) to be included
* - cost of whole span not greater than
* - factor the cars used as a factor (e.g. 3 trips * 3 cars vs 3 trips * 1 car)
* - determine the factor by which the total span including the joints may exceed
* - the sum of the trips.
* -
* This algorithm uses Prim's minimum spanning tree algorithm to determine
*  given a set of GPS points representing passenger trips (both departure and arrival points),
* the routes with the least distance between 2 or 3 passengers who are travelling
*
* @
* @params riders_depart_xy, passenger departure locations[] in x,y
* @params riders_arrive_xy, passenger arrival locations[] in x,y
* @params size, number of passengers
* @params distance, cost = distance (assumption - we ignore other costs like time, money etc)
* @params time_window
*/

var s2util = require("./s2GeometryUtility");
var lineReader = require('line-reader');
var Promise = require("bluebird");


var line_counter = 0;
var reached = [];
var unreached = [];
var gpsPoint = function(lat,lon,isDepart,name){
	this.latitude = lat;
	this.longitude = lon;
	this.isDepart = isDepart;
	this.name = name;
	this.distance = 0;

}

if(typeof(Number.prototype.toRad) === "undefined") {
    Number.prototype.toRad = function () {
        return this * Math.PI / 180;
    }
}

readDrivers = function(cb) {
    var readLine = Promise.promisify(lineReader.eachLine);
    readLine('/Users/tinyiko/WebstormProjects/GoSwift/server/config/seeds/Gps_dump.csv', function (line, last) {
        var line_str = line.split(",");
        unreached[line_counter] = new gpsPoint(line_str[0], line_str[1], line_str[2], line_str[3]);
        line_counter++;
        if (last) {
            // or check if it's the last one
            console.log("last item = " + last + "=" + line_counter);
        }
    }).then(function () {
        //console.log("total distance = " + dist(unreached));
		sortByMST();
		cb(reached);
    }).catch(function (err) {
        console.log("error message = " + err);
    });
}

/**
 * move to s2GeometryUtil
 * add distance of all edges in an array and return total distance
 * @param, array - array with edges to be summed
*/
var dist = function sumEdgeDistance(array){
	var total_distance = 0;
	var counter = 0;

	unreached.forEach(function(d){
		if(counter == array.length -1) return;
		var dist = s2util.distanceCalc(array[counter],array[counter+1]);
		total_distance = total_distance+dist;
		counter++;
	});

	return total_distance;
}

/**
* function to calculate bearing given 2 GPS points
*/
var bearing = function getBearing(first_gps, second_gps){
	var brng = Math.atan2(newLat - oldLat, newLong - oldLong);
	brng = brng * (180 / Math.PI);
	brng = (brng + 360) % 360;
	brng = 360 - brng;

	return brng;
}

/**
* Function that implements minimum spanning tree (MST) using Prim's algorithm
*
*/
var sortByMST = function(){

	//var firstReached
	reached.push(unreached[0]);
	unreached.splice(0,1);
	var record;

	while(unreached.length > 0){
		//console.log("while unreached");
		var record = 65;//in km

		var rIndex;
		var uIndex;

		for(var i = 0; i <reached.length; i++){
			for (var j = 0; j < unreached.length; j++){
				var v1 = reached[i];
				var v2 = unreached[j];

				var route_d = s2util.distanceCalc(v1,v2,2);
				if(route_d < record){

					record = route_d;
					rIndex = i;
					uIndex = j;
					unreached[j].distance = route_d;
				}
			}
		}
		reached.push(unreached[uIndex]);
		unreached.splice(uIndex,1);
	}

	var total_distance = 0;
	reached.forEach(function(d){
		total_distance += d.distance;
		console.log(d.latitude + "-"+ d.longitude + "="+ d.name + "="+d.distance);
	})

	console.log("total MST distance = " + total_distance);
	//return reached;
}

//readDrivers(function(){});
exports.readDrivers = readDrivers;
exports.getDist = s2util.distanceCalc;

readDrivers(function(results){
	console.log("results length = "+results.length);
});
/**
Algorithm strategies
- take the longest trip by distance. calculate its bearing.
iterate through all other trips with a similar bearing with a minimum
diviation

- define the maximum deviation from trip route allowable for 2nd and 3rd pickup
- define maximum total cost in distance allowable to combine 2 or 3 individual trips
- ensure that the cost of the total trip in fares still make sense (i.e. its less than
the users taking own individual trips)
-
*/