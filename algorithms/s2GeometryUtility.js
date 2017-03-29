/**
 * Created by tinyiko on 2017/03/29.
 */

var s2 = require('s2geometry-node');

var origin = new s2.S2CellId(new s2.S2LatLng(44.0378862, 10.0458712));

console.log(origin.parent(15).id());
console.log(origin.parent(15).child_end().id());

console.log(origin.toString());

