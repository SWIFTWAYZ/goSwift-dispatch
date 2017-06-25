
local cell_count = KEYS[1]
local break_count = 0
local cell_vehicles = {}
--[[or (ARGV[1] == nil) or(isnumber(ARGV[1] == true)]]
--[[hello]]

if (cell_count == nil) or (ARGV[1] == nil) then
	return nil
end 
redis.log(redis.LOG_WARNING,"ZRANGE, cell: count" .. cell_count)
redis.log(redis.LOG_WARNING,"ZRANGE, cell: count" .. ARGV[1])

local total = 0 

for index=1, tonumber(cell_count) do 
	local convert = tonumber(ARGV[index])
	if convert ~= nil  then
		local cell_id = ARGV[index]
		redis.log(redis.LOG_WARNING,"cell -> " .. ARGV[index] .. "-" .. index)
		local vehicle_id = redis.call("ZRANGE","cell:" .. cell_id,0,-1)
		cell_vehicles[index] = {}

		redis.log(redis.LOG_WARNING,"ZRANGE, cell:" .. cell_id)
		--cell_vehicles[index] = cell_id

		for vehicle_index=1, tonumber(#vehicle_id) do
			if(vehicle_id[vehicle_index] ~= nil) then
				redis.log(redis.LOG_WARNING,"ZREVRANGE, vehicle:".. vehicle_id[vehicle_index])

				local vehicle_pos = redis.call("ZREVRANGE","vehicle:" .. vehicle_id[vehicle_index],0,0)
				local vehicle_s2 = vehicle_pos[1]

				redis.log(redis.LOG_WARNING,"vehicle =" .. vehicle_id[1])
				redis.log(redis.LOG_WARNING,"vehicle table size = " .. #vehicle_pos)
				
				if(vehicle_s2 ~= nil) then
					cell_vehicles[index][vehicle_index] = vehicle_s2
					total = total + 1
					redis.log(redis.LOG_WARNING,"s2 position = " .. vehicle_s2)
				else
					redis.log(redis.LOG_WARNING,"vposition = nil")
				end 
			end 
		end 
	else
		redis.log(redis.LOG_WARNING, "nil")
	end 
	break_count = break_count + 1
	if break_count == 25 then
		break
	end 
end 
redis.log(redis.LOG_WARNING,"items = " .. total)

print("------------" .. cell_vehicles[1])

return cell_vehicles
