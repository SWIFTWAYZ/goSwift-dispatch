struct VehiclesNearRider{
	1: required string vehicle_id;
	2: required string s2_position;
	3: required double latitude;
	4: required double longitude;
}

service tripService {
	list<VehiclesNearRider> getVehiclesNearRider(
	1: double lat,
	2: double lon);

	oneway void updateDriverLocation(
	1: double lat,
	2: double lon,
	3: string vehicle_id);
}

