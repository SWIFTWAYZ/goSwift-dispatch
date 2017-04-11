/**
 * Created by tinyiko on 2017/03/28.
 */
/**
 * This file initialiazes config data for the dispatch and
 * redis servers. Also used to initialize config data for rabbitMQ
 */
(function(){

    var server_config = {
        port: '3000',
        host: 'localhost',
        redis_port: '3001',
        redis_host: 'localhost'
    };

    var city = {
        lat:'-26.104628',
        lon: '28.053901',
        radius: '32000'
    };

    exports.city = city;
    exports.server = server_config;
}).call(this);