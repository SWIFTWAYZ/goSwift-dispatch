local vcell_key = KEYS[1]

local tstamp = ARGV[1]
local vehicle_id = ARGV[2]
local new_cell = ARGV[3]
local vehicle_pos = ARGV[4]

local vehicle_key = "vehicle:" .. vehicle_id
local to_cell_key = "cell:" .. new_cell
local vcell_key = "vcell:" .. vehicle_id

local from_cell_table = redis.call("ZRANGE",vcell_key,0,0)
local from_cell_key = -1

local count = 0
for index, value in pairs(from_cell_table) do
	count = count + 1
	from_cell_key = value
end
--[[
redis.log(redis.LOG_WARNING,'current cells for vehicle ' .. vehicle_id .. '=' .. count)
redis.log(redis.LOG_WARNING,'current cell' .. from_cell_key)
]]
if count > 0 then
	local vcell_rem_retval = redis.call("ZREM",vcell_key, from_cell_key)
	--[[redis.log(redis.LOG_WARNING,'response of ZREM = ' .. vcell_rem_retval)]]

else
	--[[redis.log(redis.LOG_WARNING,"from_cell_key = 0")]]
end 
	local vcell_add_retval = redis.call("ZADD",vcell_key,tstamp,new_cell)
	
	local vehicle_add_retval = redis.call("ZADD",vehicle_key,tstamp,vehicle_pos)
	redis.log(redis.LOG_WARNING,"add vehicle = " .. vehicle_key)
	local cell_rem_retval = redis.call("ZREM","cell:" .. from_cell_key,tstamp,vehicle_id)
	local cell_add_retval = redis.call("ZADD",to_cell_key,tstamp,vehicle_id)
	
	return vehicle_add_retval
