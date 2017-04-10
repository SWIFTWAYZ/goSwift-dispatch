/**
 * Created by tinyiko on 2017/04/10.
 */

/**
 * Created by tinyiko on 2017/04/09.
 */
var s2 = require('s2geometry-node');
var _ = require('underscore');

var earth_radius = 1000 * 6378.1; // (km = 6378.1) - radius of the earth
var default_dispatch_radius = 31885;    //meters
var kEarthCircumferenceMeters = 1000 * 40075.017;

function EarthMetersToRadians(meters) {
    return (2 * Math.PI) * (meters / kEarthCircumferenceMeters);
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
        this.s2cap = s2cap;
        this.radius - radius_in_meters;
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

    S2CircleCoverer.setS2BigCell = function(cell){
        //s2.getClosestLevel(1000);
        var level = cell.level ();
        console.log("level ->" +level);
        if(level < 0 || level > 30){
            throw new Error("cell level is : " + level + " ,cell level should be between 10 and 25");
        }
        s2cell = cell;
    }

    S2CircleCoverer.getS2BigCell = function(){
        return s2cell;
    }

    /**
     * get a combination of cells at different levels as stipulated by the min,max and
     * cells constraint that approximate the covering of the circle
     * @param min
     * @param max
     * @param cells
     * @returns {null}
     */
    S2CircleCoverer.getCovering = function(min,max,cells){
        min_level = min;
        max_level = max;
        max_cells = cells;

        if(s2cell === null || typeof(s2cell) !== 'object'){
            throw new Error("getCovering can not be called on a null S2Cell");
        }
        return null;
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
    S2CircleCoverer.setMaxLevel = function(level){
        max_level = level;
    }

    S2CircleCoverer.setMinLevel= function(level){
        min_level = level;
    }

    S2CircleCoverer.setMaxCells = function(noOfCells){
        max_cells = noOfCells;
    }


    exports.S2CircleCoverer = S2CircleCoverer;

    /**
     * Testing code .....
     * @type {s2.S2CellId}
     */

    var S2_CELL_LEVEL = 11;
    var s2latLng = new s2.S2LatLng(-26.104628,28.053901);
    var s2cellId = new s2.S2CellId(s2latLng);
    var s2cell_11 = s2cellId.parent(S2_CELL_LEVEL)
    var s = new s2.S2Cell(s2cellId.parent(S2_CELL_LEVEL));
    var s2cell_11_area = s.approxArea()* kEarthCircumferenceMeters;
    console.log("s2cell area = " + s2cell_11_area);

    S2CircleCoverer.setS2BigCell(s);
    var divided = S2CircleCoverer.divide(s2cell_11);
    S2CircleCoverer.setS2CapRadius(s2latLng,2635);

    //2 * M_PI * max(0.0, height_) - calculate area of S2Cap
    var s2cap_area = (2 * Math.PI * Math.max(0.0,axis_height)) * kEarthCircumferenceMeters;
    console.log("s2cap area = " + s2cap_area);
    var ratio = s2cap_area/s2cell_11_area;
    console.log("ratio of s2cap/s2cell = " + ratio.toFixed(3)*100+"%");

    console.log("child sub-division " + divided[0].approxArea() * kEarthCircumferenceMeters +"........");
    //console.log(S2CircleCoverer.getCovering());

}).call(this);