
local cell_count = KEYS[1]
local break_count = 0
local cell_vehicles = {}
--[[or (ARGV[1] == nil) or(isnumber(ARGV[1] == true)]]
--[[hello
>> redis-cli --eval geo-radius.lua 8 , 2203795067297071104
]]

local unpacked_var = unpack(ARGV)

--[[print ("unpacked ..." .. #unpacked_var)]]

print (cell_count .. ARGV[1])
if (cell_count == nil) or (ARGV[1] == nil) then
	return nil
end 
redis.log(redis.LOG_WARNING,"ZRANGE, cell: count" .. cell_count)
redis.log(redis.LOG_WARNING,"ZRANGE, cell: count" .. ARGV[1])

local total = 0 

for index=1, tonumber(cell_count) do 
	local convert = tonumber(ARGV[index])
	print ('index = ' .. ARGV[index])

	if convert ~= nil  then
		local cell_id = ARGV[index]
		redis.log(redis.LOG_WARNING,"cell -> " .. ARGV[index] .. "-" .. index)
		local vehicle_id = redis.call("ZRANGE","cell:" .. cell_id,0,-1)
		--[[cell_vehicles[index] = {}]]


		redis.log(redis.LOG_WARNING,"--------------------------")
		redis.log(redis.LOG_WARNING,#vehicle_id .. " = vehicles in cell = " .. cell_id)
		--[[cell_vehicles[index] = cell_id]]

		--[[ total number of vehicles in cell, using #vehicle_id]]
		local vehicle_pos_count = 0

		for vehicle_index=1, tonumber(#vehicle_id) do --[[loop vehicles in cell]]
			local vehicle_id_str = vehicle_id[vehicle_index]

			if(vehicle_id_str ~= nil) then
				
				--[[get vehicle position key and assign to vehicle_pos]]
				
				redis.log(redis.LOG_WARNING,"ZREVRANGE, vehicle:".. vehicle_id_str) 
				local vehicle_pos = redis.call("ZREVRANGE","vehicle:" .. vehicle_id_str,0,0) --[[ bombs out if we retrieve 
				more than 1 element i.e. vehicle_id_str,0,10]]

				--[[take the 1st element in list of vehicle positions]]
				local vehicle_s2 = vehicle_pos[1]

				redis.log(redis.LOG_WARNING,"vehicle =" .. vehicle_id_str .. "> no. of positions = " .. #vehicle_pos)
				--[[redis.log(redis.LOG_WARNING,"vehicle table size = " .. #vehicle_pos)]]
				
				--[[if(vehicle_s2 ~= nil) then]]
				for s2_pos_index=1, tonumber(#vehicle_pos) do
					--[[cell_vehicles[index][vehicle_index] = vehicle_s2]]
					if(vehicle_id_str ~= nil and vehicle_index ~= nil) then
						 --[[cell_vehicles[vehicle_id_str] = {} ... added]]
						 vehicle_pos_count = vehicle_pos_count + 1
						cell_vehicles[vehicle_id_str] = {}
						cell_vehicles[vehicle_id_str][s2_pos_index] = vehicle_s2
					end 
					total = total + 1
					redis.log(redis.LOG_WARNING,"s2 position = " .. vehicle_s2)
				end
				--[[	redis.log(redis.LOG_WARNING,"vposition = nil")
				end ]]
			end 
		end 
	else
		redis.log(redis.LOG_WARNING, "nil")
	end 
	break_count = break_count + 1
	if break_count == 1000 then
		break
	end 
end 
redis.log(redis.LOG_WARNING,"items = " .. total)

print("------------" .. #cell_vehicles)

--[[cjson.encode_sparse_array(true, 2, 3)--]]
return cjson.encode(cell_vehicles)
