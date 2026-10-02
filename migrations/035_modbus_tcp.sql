-- Additive integration; existing configuration/inventories remain untouched.
CREATE TABLE modbus_connections (
 id TEXT PRIMARY KEY, home_id TEXT NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
 config TEXT NOT NULL CHECK(json_valid(config))
);
CREATE INDEX modbus_connections_home ON modbus_connections(home_id);
CREATE TABLE modbus_variables (
 device_id TEXT PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
 connection_id TEXT NOT NULL REFERENCES modbus_connections(id) ON DELETE RESTRICT,
 config TEXT NOT NULL CHECK(json_valid(config))
);
CREATE INDEX modbus_variables_connection ON modbus_variables(connection_id);
