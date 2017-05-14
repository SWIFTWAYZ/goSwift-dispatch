/**
 * Created by tinyiko on 2017/03/28.
 */
/**
 * This file initialiazes config data for the dispatch and
 * redis servers. Also used to initialize config data for rabbitMQ
 */

"use strict";

(function(){

    var server_config = {
        port: '3000',
        host: 'localhost',
        redis_port: '6379',
        redis_host: 'localhost'
    };

    var city = {
        lat:'-26.104628', //Sandton ICC - JHB
        lon: '28.053901',
        radius: '32000',
        name: "Johannesburg",
        centre: "Sandton ICC"
    };
    //-26.135891, 28.117186 (Edenvale - city centre)
    exports.city = city;
    exports.server = server_config;
}).call(this);