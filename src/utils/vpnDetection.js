/**
 * VPN Detection utility using IPinfo Lite API
 * Detects VPN, proxy, and fake IP usage
 */

const IPINFO_TOKEN = '5ccab212643369';
const IPINFO_BASE_URL = 'https://api.ipinfo.io';

// Known VPN/proxy ASN patterns and names
const VPN_PROXY_INDICATORS = {
    // Major VPN providers
    vpnProviders: [
        'nordvpn', 'expressvpn', 'surfshark', 'cyberghost', 'private internet access',
        'protonvpn', 'windscribe', 'tunnelbear', 'hotspot shield', 'purevpn',
        'ipvanish', 'vyprvpn', 'strongvpn', 'hidemyass', 'buffered',
        'safervpn', 'zenmate', 'freedome', 'betternet', 'opera vpn',
        'psiphon', 'tor', 'vpn', 'proxy', 'anonymizer'
    ],
    
    // Known proxy/VPN ASN names
    suspiciousASNames: [
        'digital ocean', 'amazon web services', 'google cloud', 'microsoft azure',
        'linode', 'vultr', 'ovh', 'hetzner', 'scaleway', 'contabo',
        'hostwinds', 'inmotion hosting', 'bluehost', 'hostgator',
        'datacenter', 'hosting', 'server', 'cloud', 'vps'
    ],
    
    // Known VPN/proxy ASN numbers (partial list)
    suspiciousASNs: [
        'AS14061', // DigitalOcean
        'AS16509', // Amazon AWS
        'AS15169', // Google Cloud
        'AS8075',  // Microsoft Azure
        'AS63949', // Linode
        'AS20473', // Vultr
        'AS16276', // OVH
        'AS24940', // Hetzner
        'AS12876', // Scaleway
    ]
};

/**
 * Get user's IP information from IPinfo Lite API
 * @returns {Promise<Object>} IP information object
 */
export const getIPInfo = async () => {
    try {
        const response = await fetch(`${IPINFO_BASE_URL}/lite/me?token=${IPINFO_TOKEN}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`IPinfo API error: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching IP info:', error);
        throw error;
    }
};

/**
 * Check if the IP information indicates VPN/proxy usage
 * @param {Object} ipInfo - IP information from IPinfo API
 * @returns {Object} Detection result with details
 */
export const detectVPNProxy = (ipInfo) => {
    if (!ipInfo) {
        return {
            isVPN: false,
            isProxy: false,
            confidence: 0,
            reason: 'No IP information available',
            detectedService: null
        };
    }

    const { as_name, as_domain, asn, country_code, continent_code } = ipInfo;
    
    let isVPN = false;
    let isProxy = false;
    let confidence = 0;
    let reason = '';
    let detectedService = null;

    // Check ASN name for VPN/proxy indicators
    if (as_name) {
        const asNameLower = as_name.toLowerCase();
        
        // Check for VPN provider names
        for (const vpnProvider of VPN_PROXY_INDICATORS.vpnProviders) {
            if (asNameLower.includes(vpnProvider)) {
                isVPN = true;
                confidence += 40;
                reason = `Detected VPN provider: ${as_name}`;
                detectedService = as_name;
                break;
            }
        }

        // Check for suspicious ASN names (datacenters, hosting providers)
        if (!isVPN) {
            for (const suspiciousName of VPN_PROXY_INDICATORS.suspiciousASNames) {
                if (asNameLower.includes(suspiciousName)) {
                    isProxy = true;
                    confidence += 30;
                    reason = `Detected hosting/datacenter: ${as_name}`;
                    detectedService = as_name;
                    break;
                }
            }
        }
    }

    // Check ASN number against known VPN/proxy ASNs
    if (asn && !isVPN && !isProxy) {
        for (const suspiciousASN of VPN_PROXY_INDICATORS.suspiciousASNs) {
            if (asn === suspiciousASN) {
                isProxy = true;
                confidence += 25;
                reason = `Detected suspicious ASN: ${asn}`;
                detectedService = as_name || asn;
                break;
            }
        }
    }

    // Check domain for VPN/proxy indicators
    if (as_domain && !isVPN && !isProxy) {
        const domainLower = as_domain.toLowerCase();
        for (const vpnProvider of VPN_PROXY_INDICATORS.vpnProviders) {
            if (domainLower.includes(vpnProvider)) {
                isVPN = true;
                confidence += 35;
                reason = `Detected VPN domain: ${as_domain}`;
                detectedService = as_domain;
                break;
            }
        }
    }

    // Additional heuristics
    if (!isVPN && !isProxy) {
        // Check for unusual country/continent combinations
        // This is a basic check - you might want to customize based on your region
        if (country_code === 'US' && continent_code === 'NA') {
            // This is normal for US users
        } else if (country_code === 'VN' && continent_code === 'AS') {
            // This is normal for Vietnamese users
        } else {
            // Could be suspicious, but we'll be conservative
            confidence += 10;
            reason = 'Unusual geographic location detected';
        }
    }

    return {
        isVPN,
        isProxy,
        confidence: Math.min(confidence, 100),
        reason,
        detectedService,
        ipInfo
    };
};

/**
 * Get VPN detection result with user-friendly message
 * @returns {Promise<Object>} Detection result with UI message
 */
export const checkVPNStatus = async () => {
    try {
        const ipInfo = await getIPInfo();
        const detection = detectVPNProxy(ipInfo);
        
        let message = '';
        let severity = 'info';
        
        if (detection.isVPN) {
            severity = 'warning';
            if (detection.detectedService) {
                message = `Phát hiện bạn đang sử dụng VPN/Proxy: ${detection.detectedService}. Vui lòng tắt ứng dụng VPN để tiếp tục điểm danh.`;
            } else {
                message = 'Phát hiện bạn đang sử dụng VPN/Proxy. Vui lòng tắt ứng dụng VPN để tiếp tục điểm danh.';
            }
        } else if (detection.isProxy) {
            severity = 'warning';
            if (detection.detectedService) {
                message = `Phát hiện bạn đang sử dụng dịch vụ proxy: ${detection.detectedService}. Vui lòng tắt ứng dụng proxy để tiếp tục điểm danh.`;
            } else {
                message = 'Phát hiện bạn đang sử dụng dịch vụ proxy. Vui lòng tắt ứng dụng proxy để tiếp tục điểm danh.';
            }
        } else if (detection.confidence > 50) {
            severity = 'warning';
            message = 'Phát hiện có thể bạn đang sử dụng VPN/Proxy. Vui lòng tắt ứng dụng VPN/Proxy để tiếp tục điểm danh.';
        } else {
            message = 'Kết nối mạng của bạn bình thường.';
        }

        return {
            ...detection,
            message,
            severity,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('Error checking VPN status:', error);
        return {
            isVPN: false,
            isProxy: false,
            confidence: 0,
            reason: 'Unable to check VPN status',
            message: 'Không thể kiểm tra trạng thái VPN. Vui lòng thử lại.',
            severity: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
};

/**
 * Get common VPN application names for user guidance
 * @returns {Array} List of common VPN applications
 */
export const getCommonVPNApps = () => {
    return [
        'NordVPN',
        'ExpressVPN', 
        'Surfshark',
        'CyberGhost',
        'Private Internet Access',
        'ProtonVPN',
        'Windscribe',
        'TunnelBear',
        'Hotspot Shield',
        'PureVPN',
        'IPVanish',
        'VyprVPN',
        'StrongVPN',
        'HideMyAss',
        'Buffered',
        'SaferVPN',
        'ZenMate',
        'Freedome',
        'BetterNet',
        'Opera VPN',
        'Psiphon',
        'Tor Browser'
    ];
};