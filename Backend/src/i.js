import AT from 'africastalking';

const africastalking = AT({
    username: 'Sandbox', 
    // IMPORTANT: Ensure this is your SANDBOX key (usually letters/numbers, no 'atsk_')
    apiKey: 'atsk_78f5ede9611eb17ab8d42313d7f422af751c21f0afc3d881b81265f662ce26d4bd9c0922' 
});

const sms = africastalking.SMS;

const options = {
    to: ['+250786446835'], 
    message: 'MAIZESMART ALERT: Low soil moisture detected in Rwamagana. Irrigation activated.',
    
    // FIX: Use the Sandbox shortcode '44005' or comment this line out entirely
    from: '44005' 
};

sms.send(options)
    .then(response => {
        console.log('Success! Check the simulator:', JSON.stringify(response, null, 2));
    })
    .catch(error => {
        console.error('Failed to send alert:', error.response ? error.response.data : error.message);
    });