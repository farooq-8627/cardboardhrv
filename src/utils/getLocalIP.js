// Function to get the local network IP address
export const getLocalIP = async () => {
	try {
		// Use WebRTC to get local IP addresses
		const pc = new RTCPeerConnection({ iceServers: [] });
		pc.createDataChannel("");

		const offer = await pc.createOffer();
		await pc.setLocalDescription(offer);

		return new Promise((resolve) => {
			pc.onicecandidate = (ice) => {
				if (ice && ice.candidate && ice.candidate.candidate) {
					const localIpRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3})/;
					const match = ice.candidate.candidate.match(localIpRegex);
					if (match) {
						const ip = match[1];
						if (!ip.startsWith("127.")) {
							pc.onicecandidate = null;
							pc.close();
							resolve(ip);
						}
					}
				}
			};

			// Resolve with null after 1 second if no IP is found
			setTimeout(() => {
				pc.close();
				resolve(null);
			}, 1000);
		});
	} catch (error) {
		console.error("Error getting local IP:", error);
		return null;
	}
};
