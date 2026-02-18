-- =====================================================
-- Smart Maize Farming System - Database Schema
-- PostgreSQL / Supabase Migration Script
-- =====================================================
-- Run this script in Supabase SQL Editor to create all tables

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- =====================================================
-- ENUM TYPES
-- =====================================================

-- User roles enum
CREATE TYPE user_role AS ENUM ('farmer', 'expert', 'admin');

-- Recommendation status enum
CREATE TYPE recommendation_status AS ENUM ('pending', 'accepted', 'rejected', 'deferred', 'executed', 'expired');

-- Recommendation type enum
CREATE TYPE recommendation_type AS ENUM ('irrigation', 'fertilization', 'pest_alert', 'weather_alert', 'general');

-- Recommendation priority enum
CREATE TYPE recommendation_priority AS ENUM ('critical', 'high', 'medium', 'low');

-- Sensor type enum
CREATE TYPE sensor_type AS ENUM ('soil_moisture', 'temperature', 'humidity', 'npk', 'rainfall', 'light');

-- Sensor status enum
CREATE TYPE sensor_status AS ENUM ('active', 'inactive', 'maintenance', 'faulty');

-- Pest detection severity enum
CREATE TYPE pest_severity AS ENUM ('none', 'low', 'moderate', 'high', 'severe');

-- Message status enum
CREATE TYPE message_status AS ENUM ('queued', 'sent', 'delivered', 'failed', 'read');

-- Message channel enum
CREATE TYPE message_channel AS ENUM ('sms', 'ussd', 'push', 'email');

-- =====================================================
-- USERS TABLE
-- =====================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clerk_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone_number VARCHAR(20),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role user_role NOT NULL DEFAULT 'farmer',
    preferred_language VARCHAR(10) DEFAULT 'rw', -- Kinyarwanda by default
    profile_image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    last_login_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_users_clerk_id ON users(clerk_id);
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email ON users(email);

-- =====================================================
-- DISTRICTS TABLE (Rwanda Administrative)
-- =====================================================

CREATE TABLE districts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    province VARCHAR(100) NOT NULL,
    coordinates GEOGRAPHY(POINT, 4326),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_districts_name ON districts(name);
CREATE INDEX idx_districts_coordinates ON districts USING GIST(coordinates);

-- =====================================================
-- FARMS TABLE
-- =====================================================

CREATE TABLE farms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    district_id UUID REFERENCES districts(id),
    location_name VARCHAR(255),
    coordinates GEOGRAPHY(POINT, 4326),
    size_hectares DECIMAL(10, 4),
    soil_type VARCHAR(100),
    crop_variety VARCHAR(100) DEFAULT 'maize',
    planting_date DATE,
    expected_harvest_date DATE,
    current_growth_stage VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_farms_user_id ON farms(user_id);
CREATE INDEX idx_farms_district_id ON farms(district_id);
CREATE INDEX idx_farms_coordinates ON farms USING GIST(coordinates);
CREATE INDEX idx_farms_active ON farms(is_active) WHERE is_active = true;

-- =====================================================
-- SENSORS TABLE
-- =====================================================

CREATE TABLE sensors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    device_id VARCHAR(100) UNIQUE NOT NULL,
    sensor_type sensor_type NOT NULL,
    name VARCHAR(255),
    location_description VARCHAR(255),
    coordinates GEOGRAPHY(POINT, 4326),
    status sensor_status DEFAULT 'active',
    battery_level INTEGER,
    firmware_version VARCHAR(50),
    last_reading_at TIMESTAMP WITH TIME ZONE,
    calibration_date DATE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sensors_farm_id ON sensors(farm_id);
CREATE INDEX idx_sensors_device_id ON sensors(device_id);
CREATE INDEX idx_sensors_type ON sensors(sensor_type);
CREATE INDEX idx_sensors_status ON sensors(status);

-- =====================================================
-- SENSOR DATA TABLE (Time-series)
-- =====================================================

CREATE TABLE sensor_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sensor_id UUID NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    reading_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Soil moisture (percentage)
    soil_moisture DECIMAL(5, 2),
    
    -- Temperature readings (Celsius)
    soil_temperature DECIMAL(5, 2),
    air_temperature DECIMAL(5, 2),
    
    -- Humidity (percentage)
    humidity DECIMAL(5, 2),
    
    -- NPK nutrient levels (mg/kg)
    nitrogen DECIMAL(8, 2),
    phosphorus DECIMAL(8, 2),
    potassium DECIMAL(8, 2),
    
    -- Additional readings
    ph_level DECIMAL(4, 2),
    light_intensity DECIMAL(10, 2),
    rainfall_mm DECIMAL(8, 2),
    
    -- Data quality flags
    is_valid BOOLEAN DEFAULT true,
    validation_flags JSONB DEFAULT '{}',
    
    -- Raw data for debugging
    raw_payload JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Optimized indexes for time-series queries
CREATE INDEX idx_sensor_data_sensor_id ON sensor_data(sensor_id);
CREATE INDEX idx_sensor_data_farm_id ON sensor_data(farm_id);
CREATE INDEX idx_sensor_data_timestamp ON sensor_data(reading_timestamp DESC);
CREATE INDEX idx_sensor_data_farm_time ON sensor_data(farm_id, reading_timestamp DESC);
CREATE INDEX idx_sensor_data_valid ON sensor_data(is_valid) WHERE is_valid = true;

-- Partition hint (implement if needed for large datasets)
-- Consider partitioning by month for production

-- =====================================================
-- WEATHER DATA TABLE
-- =====================================================

CREATE TABLE weather_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    district_id UUID REFERENCES districts(id),
    coordinates GEOGRAPHY(POINT, 4326),
    forecast_date DATE NOT NULL,
    forecast_time TIME,
    
    -- Current conditions
    temperature DECIMAL(5, 2),
    feels_like DECIMAL(5, 2),
    humidity INTEGER,
    pressure INTEGER,
    wind_speed DECIMAL(5, 2),
    wind_direction INTEGER,
    
    -- Precipitation
    precipitation_probability INTEGER,
    precipitation_mm DECIMAL(8, 2),
    rain_mm DECIMAL(8, 2),
    
    -- General
    weather_condition VARCHAR(100),
    weather_description TEXT,
    cloud_cover INTEGER,
    uv_index DECIMAL(4, 2),
    
    -- API source
    source VARCHAR(50) DEFAULT 'openweathermap',
    raw_response JSONB,
    
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_weather_district ON weather_data(district_id);
CREATE INDEX idx_weather_date ON weather_data(forecast_date);
CREATE INDEX idx_weather_coordinates ON weather_data USING GIST(coordinates);
CREATE INDEX idx_weather_fetched ON weather_data(fetched_at DESC);

-- =====================================================
-- PEST DETECTIONS TABLE
-- =====================================================

CREATE TABLE pest_detections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    reported_by UUID NOT NULL REFERENCES users(id),
    
    -- Image data
    image_url TEXT NOT NULL,
    cloudinary_public_id VARCHAR(255),
    thumbnail_url TEXT,
    
    -- Detection results
    pest_detected BOOLEAN DEFAULT false,
    pest_type VARCHAR(100),
    severity pest_severity DEFAULT 'none',
    confidence_score DECIMAL(5, 4), -- 0.0000 to 1.0000
    affected_area_percentage DECIMAL(5, 2),
    
    -- AI model info
    model_version VARCHAR(50),
    detection_metadata JSONB DEFAULT '{}',
    
    -- Location within farm
    location_description VARCHAR(255),
    coordinates GEOGRAPHY(POINT, 4326),
    
    -- Expert review
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    expert_notes TEXT,
    is_confirmed BOOLEAN,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_pest_farm ON pest_detections(farm_id);
CREATE INDEX idx_pest_reporter ON pest_detections(reported_by);
CREATE INDEX idx_pest_detected ON pest_detections(pest_detected) WHERE pest_detected = true;
CREATE INDEX idx_pest_severity ON pest_detections(severity);
CREATE INDEX idx_pest_created ON pest_detections(created_at DESC);

-- =====================================================
-- IRRIGATION SCHEDULES TABLE
-- =====================================================

CREATE TABLE irrigation_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    recommendation_id UUID,
    
    -- Schedule details
    scheduled_date DATE NOT NULL,
    scheduled_time TIME,
    duration_minutes INTEGER NOT NULL,
    water_volume_liters DECIMAL(10, 2),
    
    -- Execution tracking
    is_executed BOOLEAN DEFAULT false,
    executed_at TIMESTAMP WITH TIME ZONE,
    actual_duration_minutes INTEGER,
    actual_water_volume DECIMAL(10, 2),
    
    -- Scheduling metadata
    trigger_source VARCHAR(50), -- 'manual', 'auto', 'recommendation'
    soil_moisture_at_scheduling DECIMAL(5, 2),
    target_soil_moisture DECIMAL(5, 2),
    
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_irrigation_farm ON irrigation_schedules(farm_id);
CREATE INDEX idx_irrigation_date ON irrigation_schedules(scheduled_date);
CREATE INDEX idx_irrigation_executed ON irrigation_schedules(is_executed);

-- =====================================================
-- FERTILIZATION SCHEDULES TABLE
-- =====================================================

CREATE TABLE fertilization_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    recommendation_id UUID,
    
    -- Schedule details
    scheduled_date DATE NOT NULL,
    fertilizer_type VARCHAR(100) NOT NULL,
    application_method VARCHAR(100),
    
    -- Quantities
    nitrogen_kg DECIMAL(8, 2),
    phosphorus_kg DECIMAL(8, 2),
    potassium_kg DECIMAL(8, 2),
    total_quantity_kg DECIMAL(10, 2),
    
    -- Execution tracking
    is_executed BOOLEAN DEFAULT false,
    executed_at TIMESTAMP WITH TIME ZONE,
    actual_quantity_kg DECIMAL(10, 2),
    
    -- Context
    growth_stage VARCHAR(50),
    soil_npk_at_scheduling JSONB,
    
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_fertilization_farm ON fertilization_schedules(farm_id);
CREATE INDEX idx_fertilization_date ON fertilization_schedules(scheduled_date);
CREATE INDEX idx_fertilization_executed ON fertilization_schedules(is_executed);

-- =====================================================
-- RECOMMENDATIONS TABLE
-- =====================================================

CREATE TABLE recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    
    -- Recommendation details
    type recommendation_type NOT NULL,
    priority recommendation_priority DEFAULT 'medium',
    status recommendation_status DEFAULT 'pending',
    
    -- Content
    title VARCHAR(255) NOT NULL,
    title_rw VARCHAR(255), -- Kinyarwanda translation
    description TEXT NOT NULL,
    description_rw TEXT,
    
    -- Action details
    recommended_action TEXT,
    action_deadline TIMESTAMP WITH TIME ZONE,
    
    -- Supporting data
    supporting_data JSONB DEFAULT '{}',
    confidence_score DECIMAL(5, 4),
    model_version VARCHAR(50),
    
    -- User response
    responded_at TIMESTAMP WITH TIME ZONE,
    response_notes TEXT,
    deferred_until TIMESTAMP WITH TIME ZONE,
    
    -- Notification tracking
    notification_sent BOOLEAN DEFAULT false,
    notification_sent_at TIMESTAMP WITH TIME ZONE,
    notification_channel message_channel,
    
    -- Linked schedules
    irrigation_schedule_id UUID REFERENCES irrigation_schedules(id),
    fertilization_schedule_id UUID REFERENCES fertilization_schedules(id),
    pest_detection_id UUID REFERENCES pest_detections(id),
    
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_recommendations_farm ON recommendations(farm_id);
CREATE INDEX idx_recommendations_user ON recommendations(user_id);
CREATE INDEX idx_recommendations_type ON recommendations(type);
CREATE INDEX idx_recommendations_status ON recommendations(status);
CREATE INDEX idx_recommendations_priority ON recommendations(priority);
CREATE INDEX idx_recommendations_created ON recommendations(created_at DESC);
CREATE INDEX idx_recommendations_pending ON recommendations(status) WHERE status = 'pending';

-- =====================================================
-- MESSAGES TABLE (Communication Log)
-- =====================================================

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    recommendation_id UUID REFERENCES recommendations(id),
    
    -- Message details
    channel message_channel NOT NULL,
    recipient VARCHAR(100) NOT NULL, -- phone number or email
    
    -- Content
    subject VARCHAR(255),
    content TEXT NOT NULL,
    content_rw TEXT, -- Kinyarwanda version
    
    -- Delivery status
    status message_status DEFAULT 'queued',
    external_message_id VARCHAR(255), -- ID from SMS provider
    
    -- Tracking
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    failed_reason TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Cost tracking
    cost_units DECIMAL(10, 4),
    
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_messages_user ON messages(user_id);
CREATE INDEX idx_messages_recommendation ON messages(recommendation_id);
CREATE INDEX idx_messages_status ON messages(status);
CREATE INDEX idx_messages_channel ON messages(channel);
CREATE INDEX idx_messages_created ON messages(created_at DESC);

-- =====================================================
-- SYSTEM CONFIGURATION TABLE
-- =====================================================

CREATE TABLE system_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value JSONB NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_system_config_key ON system_config(config_key);

-- =====================================================
-- AUDIT LOG TABLE
-- =====================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);

-- =====================================================
-- IOT DEVICE TOKENS TABLE
-- =====================================================

CREATE TABLE iot_device_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id VARCHAR(100) NOT NULL REFERENCES sensors(device_id),
    token_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_device_tokens_device ON iot_device_tokens(device_id);
CREATE INDEX idx_device_tokens_active ON iot_device_tokens(is_active) WHERE is_active = true;

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_farms_updated_at BEFORE UPDATE ON farms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sensors_updated_at BEFORE UPDATE ON sensors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pest_detections_updated_at BEFORE UPDATE ON pest_detections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_irrigation_schedules_updated_at BEFORE UPDATE ON irrigation_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fertilization_schedules_updated_at BEFORE UPDATE ON fertilization_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recommendations_updated_at BEFORE UPDATE ON recommendations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON system_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update sensor last_reading_at
CREATE OR REPLACE FUNCTION update_sensor_last_reading()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE sensors 
    SET last_reading_at = NEW.reading_timestamp
    WHERE id = NEW.sensor_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sensor_reading_timestamp
    AFTER INSERT ON sensor_data
    FOR EACH ROW EXECUTE FUNCTION update_sensor_last_reading();

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensors ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE pest_detections ENABLE ROW LEVEL SECURITY;
ALTER TABLE irrigation_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE fertilization_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid()::text = clerk_id);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid()::text = clerk_id);

-- Farms policies
CREATE POLICY "Farmers can view own farms" ON farms
    FOR SELECT USING (
        user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text)
    );

CREATE POLICY "Farmers can manage own farms" ON farms
    FOR ALL USING (
        user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text)
    );

-- Experts can view all farms
CREATE POLICY "Experts can view all farms" ON farms
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE clerk_id = auth.uid()::text 
            AND role IN ('expert', 'admin')
        )
    );

-- Sensor data policies
CREATE POLICY "Users can view own sensor data" ON sensor_data
    FOR SELECT USING (
        farm_id IN (
            SELECT f.id FROM farms f
            JOIN users u ON f.user_id = u.id
            WHERE u.clerk_id = auth.uid()::text
        )
    );

CREATE POLICY "Experts can view all sensor data" ON sensor_data
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE clerk_id = auth.uid()::text 
            AND role IN ('expert', 'admin')
        )
    );

-- Recommendations policies
CREATE POLICY "Users can view own recommendations" ON recommendations
    FOR SELECT USING (
        user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text)
    );

CREATE POLICY "Users can update own recommendations" ON recommendations
    FOR UPDATE USING (
        user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text)
    );

-- Messages policies
CREATE POLICY "Users can view own messages" ON messages
    FOR SELECT USING (
        user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text)
    );

-- =====================================================
-- SEED DATA FOR DISTRICTS
-- =====================================================

INSERT INTO districts (name, province) VALUES
    ('Bugesera', 'Eastern'),
    ('Gatsibo', 'Eastern'),
    ('Kayonza', 'Eastern'),
    ('Kirehe', 'Eastern'),
    ('Ngoma', 'Eastern'),
    ('Nyagatare', 'Eastern'),
    ('Rwamagana', 'Eastern'),
    ('Gasabo', 'Kigali'),
    ('Kicukiro', 'Kigali'),
    ('Nyarugenge', 'Kigali'),
    ('Burera', 'Northern'),
    ('Gakenke', 'Northern'),
    ('Gicumbi', 'Northern'),
    ('Musanze', 'Northern'),
    ('Rulindo', 'Northern'),
    ('Gisagara', 'Southern'),
    ('Huye', 'Southern'),
    ('Kamonyi', 'Southern'),
    ('Muhanga', 'Southern'),
    ('Nyamagabe', 'Southern'),
    ('Nyanza', 'Southern'),
    ('Nyaruguru', 'Southern'),
    ('Ruhango', 'Southern'),
    ('Karongi', 'Western'),
    ('Ngororero', 'Western'),
    ('Nyabihu', 'Western'),
    ('Nyamasheke', 'Western'),
    ('Rubavu', 'Western'),
    ('Rusizi', 'Western'),
    ('Rutsiro', 'Western');

-- =====================================================
-- DEFAULT SYSTEM CONFIGURATION
-- =====================================================

INSERT INTO system_config (config_key, config_value, description) VALUES
    ('irrigation_thresholds', '{"min_soil_moisture": 25, "optimal_min": 50, "optimal_max": 70, "max_soil_moisture": 85}', 'Soil moisture thresholds for irrigation recommendations'),
    ('pest_detection', '{"confidence_threshold": 0.75, "alert_severity_threshold": "moderate"}', 'Pest detection AI model configuration'),
    ('notification_settings', '{"critical_delay_ms": 0, "important_delay_ms": 300000, "routine_batch_interval_ms": 3600000}', 'Notification timing configuration'),
    ('fertilizer_npk_ranges', '{"nitrogen": {"min": 150, "max": 250}, "phosphorus": {"min": 25, "max": 50}, "potassium": {"min": 150, "max": 250}}', 'Optimal NPK nutrient ranges for maize'),
    ('sensor_validation', '{"max_rate_of_change": {"soil_moisture": 20, "temperature": 10}, "valid_ranges": {"soil_moisture": [0, 100], "temperature": [-10, 60]}}', 'Sensor data validation rules');

-- =====================================================
-- VIEWS FOR ANALYTICS
-- =====================================================

-- Farm summary view
CREATE OR REPLACE VIEW farm_summary AS
SELECT 
    f.id as farm_id,
    f.name as farm_name,
    f.user_id,
    u.first_name || ' ' || u.last_name as owner_name,
    f.size_hectares,
    f.current_growth_stage,
    d.name as district_name,
    d.province,
    (SELECT COUNT(*) FROM sensors s WHERE s.farm_id = f.id AND s.status = 'active') as active_sensors,
    (SELECT COUNT(*) FROM recommendations r WHERE r.farm_id = f.id AND r.status = 'pending') as pending_recommendations,
    (SELECT soil_moisture FROM sensor_data sd WHERE sd.farm_id = f.id AND sd.is_valid = true ORDER BY reading_timestamp DESC LIMIT 1) as latest_soil_moisture,
    (SELECT reading_timestamp FROM sensor_data sd WHERE sd.farm_id = f.id ORDER BY reading_timestamp DESC LIMIT 1) as last_reading_at
FROM farms f
JOIN users u ON f.user_id = u.id
LEFT JOIN districts d ON f.district_id = d.id
WHERE f.is_active = true;

-- Daily sensor aggregates view
CREATE OR REPLACE VIEW daily_sensor_aggregates AS
SELECT 
    farm_id,
    DATE(reading_timestamp) as reading_date,
    AVG(soil_moisture) as avg_soil_moisture,
    MIN(soil_moisture) as min_soil_moisture,
    MAX(soil_moisture) as max_soil_moisture,
    AVG(air_temperature) as avg_temperature,
    AVG(humidity) as avg_humidity,
    AVG(nitrogen) as avg_nitrogen,
    AVG(phosphorus) as avg_phosphorus,
    AVG(potassium) as avg_potassium,
    COUNT(*) as reading_count
FROM sensor_data
WHERE is_valid = true
GROUP BY farm_id, DATE(reading_timestamp);

-- Recommendation analytics view
CREATE OR REPLACE VIEW recommendation_analytics AS
SELECT 
    DATE(created_at) as date,
    type,
    status,
    COUNT(*) as count,
    AVG(EXTRACT(EPOCH FROM (responded_at - created_at))/3600) as avg_response_time_hours
FROM recommendations
GROUP BY DATE(created_at), type, status;

COMMENT ON VIEW farm_summary IS 'Summary view of farm data with latest readings';
COMMENT ON VIEW daily_sensor_aggregates IS 'Daily aggregated sensor readings per farm';
COMMENT ON VIEW recommendation_analytics IS 'Analytics view for recommendation performance';
