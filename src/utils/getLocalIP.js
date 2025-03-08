/**
 * Utility function to detect the local IP address of the device
 * This is used to establish a connection between devices on the same network
 */

export const getLocalIP = async () => {
	try {
		// Use WebRTC to get local IP addresses
		const pc = new RTCPeerConnection({
			iceServers: []
		});
		
		// Create a dummy data channel
		pc.createDataChannel('');
		
		// Create an offer to activate the ICE candidate gathering
		const offer = await pc.createOffer();
		await pc.setLocalDescription(offer);
		
		// Wait for ICE gathering to complete
		return new Promise((resolve) => {
			// Set a timeout in case ICE gathering takes too long
			const timeout = setTimeout(() => {
				pc.close();
				resolve(null);
			}, 5000);
			
			// Listen for ICE candidates
			pc.onicecandidate = (ice) => {
				// ICE gathering is complete when ice.candidate is null
				if (!ice.candidate) {
					clearTimeout(timeout);
					pc.close();
					
					// Extract IP from SDP
					const localIPs = [];
					const sdp = pc.localDescription.sdp;
					const lines = sdp.split('\n');
					
					for (const line of lines) {
						// Look for IPv4 addresses in the SDP
						if (line.indexOf('a=candidate:') === 0) {
							const parts = line.split(' ');
							const ip = parts[4];
							
							// Filter out local and private IPs
							if (ip.indexOf('.') !== -1 && 
								!ip.startsWith('0.') && 
								!ip.startsWith('127.') && 
								ip !== '0.0.0.0') {
								localIPs.push(ip);
							}
						}
					}
					
					// Return the first non-local IP found, or null if none
					resolve(localIPs.length > 0 ? localIPs[0] : null);
				}
			};
		});
	} catch (error) {
		console.error('Error detecting local IP:', error);
		return null;
	}
};

export default getLocalIP;
