/**
 * Created by tinyiko on 2017/04/09.
 *
 */

var s2 = require("nodes2ts");
var _ = require('underscore');
var constants = require("../constants");
var s2common = require("./s2common");
var redis = require("../redis/redisProvider");

var cap_area;

function getS2CapRadius(latLng,radius_in_meters){
    var s2cap_ts;
    if(latLng !== null && typeof(latLng) === 'object') {
        var radius_radians = s2common.EarthMetersToRadians(radius_in_meters);
        axis_height = (radius_radians * radius_radians) / 2;
        s2cap_ts = new s2.S2Cap(latLng.normalized().toPoint(), axis_height);

        var area = (2 * Math.PI * Math.max(0.0,axis_height)) * constants.KEARTH_CIRCUMFERENCE_METERS;
        cap_area = area;
        console.log("spherical cap area = " + area);
    }
    return s2cap_ts;
}

(function(){
    var S2CircleCoverer,
        s2cap,
        radius,
        axis_height,
        min_level,
        max_level,
        max_cells,
        s2cell;

    var S2CircleCoverer = {};

   S2CircleCoverer.setS2CapRadius = function(latLng,radius_in_meters){
        //this.s2cap = s2cap;
        //this.radius - radius_in_meters;
        if(latLng !== null && typeof(latLng) === 'object') {
            var radius_radians = EarthMetersToRadians(radius_in_meters);
            axis_height = (radius_radians * radius_radians) / 2;
            s2cap = new s2.S2Cap(latLng.normalized().toPoint(), axis_height);
            console.log("s2cap = " + s2cap.getRectBound().size());
        }
    }

    S2CircleCoverer.getS2CapRadius = function(){
        return s2cap;
    }

    /**
     * get a combination of cells at different levels as stipulated by the min,max and
     * cells constraints that approximate the covering of the spherical cap (lat,lot,radius)
     * @param lat
     * @param lon
     * @param radius
     * @param min
     * @param max
     * @param cells
     * @returns {null}
     */
    S2CircleCoverer.getCovering = function(lat,lon,radius,min,max,cells){
        var covering = new s2.S2RegionCoverer();
        covering.setMinLevel(min);
        covering.setMaxLevel(max);
        covering.setMaxCells(cells);

        var counter = 0;
        var covering_area = 0;

        var centre_gps = new s2.S2LatLng.fromDegrees(lat,lon);
        var cap2 = getS2CapRadius(centre_gps,radius);
        var results = covering.getCoveringCells(cap2);

        console.log("{"+'"type":"FeatureCollection","features":[');
        //dont really need this loop except for being verbose. turn it off in prooduction
        results.forEach(function(record){
            var cell = new s2.S2Cell(record);
            //console.log(JSON.stringify(cell.toGEOJSON())+"," );
            counter++;
            var cell_area = cell.approxArea() * kEarthCircumferenceMeters;
            covering_area += cell_area;
        });
        console.log("]}");
        console.log("no. of cells in region = " + counter + "-> area = " +covering_area);
        return results;
    }

    /**
     * get covering for rectangle representing a city boundary
     * @param rect_latlng
     * @param min
     * @param max
     * @param cells
     */
    S2CircleCoverer.getSquareCovering = function(rect_latlng,min,max,cells){
        var counter = 0;
        var covering_area = 0;

        var city_covering = new s2.S2RegionCoverer();
        city_covering.setMinLevel(min);
        city_covering.setMaxLevel(max);
        city_covering.setMaxCells(cells);

        var results = city_covering.getCoveringCells(rect_latlng);

        results.forEach(function(record){
            var cell = new s2.S2Cell(record);
            counter++;
            var cell_area = cell.approxArea() * kEarthCircumferenceMeters;
            covering_area += cell_area;
            console.log(JSON.stringify(cell.toGEOJSON())+",");
        });
        console.log("no. of cells in region = " + counter + "-> area = " +covering_area);
        return results;
    }

    /**
     * divide the bigger cell into child cells of index 0...3
     * @param next_cell_id
     * @returns {Array}
     */
    S2CircleCoverer.divide = function(next_cell_id){

        var level = next_cell_id.level(); //e.g. 10
        var divided_cell_id;
        var divided_cell;
        var children = new Array();
        for(i = 0; i < 4; i++) {
            divided_cell_id = next_cell_id.child(i);
            divided_cell = new s2.S2Cell(divided_cell_id);
            children.push(divided_cell);
        }
        //var divided_cell = new s2.S2Cell(divided_cell_id);
        //var size = divided_cell.approxArea() * kEarthCircumferenceMeters;
        return children;
    }

    /**
     * check containment of sub_cell within the S2Cap
     * @param sub_cell
     */
    S2CircleCoverer.isContained = function(sub_cell){
    }

    S2CircleCoverer.initialise = function(lat,lon,radius){
        //min_level,max_level,max_cells
        var city_grid = this.getCovering(lat,lon,radius,12,14,constants.DEFAULT_CITY_MAX_CELLS);//s2circle.S2CircleCoverer
        //add code to check if redis is connected and ready?
        city_grid.forEach(function(city_cell){
            var city_s2cell = new s2.S2Cell(city_cell)
            var area = (city_s2cell.approxArea()*1000000*1000 * 40075.017).toFixed(0);
            //console.log("adding id="+city_cell.id + ":/to city grid at level = "+
              //  city_s2cell.level +"->>["+(area)+"]");
            //console.log(JSON.stringify(city_s2cell.toGEOJSON())+",");

            redis.redisService.createCellPosition(city_cell.id);
        });
    }

    exports.S2CircleCoverer = S2CircleCoverer;

}).call(this);

//exports.getS2CapRadius = getS2CapRadius;