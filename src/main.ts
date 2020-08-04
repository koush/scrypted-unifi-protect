import sdk, { ScryptedDeviceBase, DeviceProvider, Settings, Setting, ScryptedDeviceType, VideoCamera, MediaObject, DeviceManifest, Device, MotionSensor, Refresh, ScryptedInterfaceDescriptors, ScryptedInterface } from "@scrypted/sdk";
const { log, deviceManager, mediaManager } = sdk;
import axios from 'axios';
import throttle from 'lodash/throttle';

class RtspCamera extends ScryptedDeviceBase implements VideoCamera, MotionSensor, Refresh {
    protect: UnifiProtect;

    constructor(protect: UnifiProtect, nativeId: string) {
        super(nativeId);
        this.protect = protect;
    }
    getRefreshFrequency(): number {
        return 1;
    }
    refresh(refreshInterface: string, userInitiated: boolean): void {
        this.protect.refresh();
    }
    getVideoStream(): MediaObject {
        var u = this.metadata.rtsp;
        if (u == null) {
            return null;
        }

        if (this.storage.getItem("ffmpeg") === 'true') {
            return mediaManager.createFFmpegMediaObject({
                inputArguments: [
                    "-an",
                    "-i",
                    u.toString(),
                    "-reorder_queue_size",
                    "1024",
                    "-max_delay",
                    "2000000",
                ]
            });
        }

        // mime type will be inferred from the rtsp scheme, and null may be passed.
        return mediaManager.createMediaObject(u, null);
    }
}


class UnifiProtect extends ScryptedDeviceBase implements Settings, DeviceProvider {
    authorization: string|undefined;
    accessKey: string|undefined;
    cameras: Map<string, RtspCamera> = new Map();

    constructor() {
        super();

        this.discoverDevices(0)
    }

    refreshThrottle = throttle(async () => {
        const {cameras} = await this.getState();
        for (const camera of cameras) {
            const rtsp = this.cameras.get(camera.mac);
            if (!rtsp)
                continue;
            if (rtsp.storage.getItem('lastMotion') != camera.lastMotion) {
                rtsp.storage.setItem('lastMotion', camera.lastMotion.toString());
                rtsp.motionDetected = true;
                setTimeout(() => {
                    rtsp.motionDetected = false;
                }, 10000);
            }
        }
    }, 1000);
    async refresh() {
        this.refreshThrottle();
    }

    async getState(): Promise<any> {
        const ip = this.getSetting('ip');
        const username = this.getSetting('username');
        const password = this.getSetting('password');

        const response = await axios.post(`https://${ip}:7443/api/auth`, {
            username,
            password,
        }, {
            headers: {
                Origin: `https://${ip}:7443`,
                'Content-Type': 'application/json; charset=utf-8',
            }
        })

        this.authorization = response.headers.authorization;

        const bootstrapResponse = await axios(`https://${ip}:7443/api/bootstrap`, {
            headers: {
                Authorization: `Bearer ${this.authorization}`
            }
        });

        const {accessKey} = bootstrapResponse.data;
        this.accessKey = accessKey;
        return bootstrapResponse.data;
    }

    async discoverDevices(duration: number) {
        const ip = this.getSetting('ip');
        const username = this.getSetting('username');
        const password = this.getSetting('password');

        this.log.clearAlerts();

        if (!ip) {
            this.log.a('Must provide IP address.');
            return
        }

        if (!username) {
            this.log.a('Must provide username.');
            return
        }

        if (!password) {
            this.log.a('Must provide password.');
            return
        }

        try {
            const {cameras} = await this.getState();

            const devices: Device[] = [];
            
            for (const camera of cameras) {
                const rtspChannels = camera.channels.filter(channel => channel.isRtspEnabled)
                if (!rtspChannels.length) {
                    log.a(`RTSP is not enabled on the Unifi Camera: ${camera.name}`);
                    continue;
                }
                const rtspChannel = rtspChannels[0];

                const {rtspAlias} = rtspChannel;

                devices.push({
                    name: camera.name,
                    nativeId: camera.mac,
                    interfaces: [ScryptedInterface.VideoCamera, ScryptedInterface.MotionSensor, ScryptedInterface.Refresh],
                    type: ScryptedDeviceType.Camera,
                    metadata: {
                        rtsp: `rtsp://${ip}:7447/${rtspAlias}`
                    }
                })
            }

            deviceManager.onDevicesChanged({
                devices
            })
        }
        catch (e) {
            this.log.a(`login error: ${e}`);
        }
    }

    getDevice(nativeId: string): object {
        if (this.cameras.has(nativeId))
            return this.cameras.get(nativeId);
        const ret = new RtspCamera(this, nativeId);
        this.cameras.set(nativeId, ret);
        this.refresh();
        return ret;
    }

    getSetting(key: string): string {
        return this.storage.getItem(key);
    }
    getSettings(): Setting[] {
        this.log.i('getting settings');
        return [
            {
                key: 'ip',
                title: 'Unifi Protect IP',
                placeholder: '192.168.1.100',
                value: this.getSetting('ip') || '',
            },
            {
                key: 'username',
                title: 'Username',
                value: this.getSetting('username') || '',
            },
            {
                key: 'password',
                title: 'Password',
                type: 'Password',
                value: this.getSetting('password') || '',
            },
        ];
    }
    putSetting(key: string, value: string | number): void {
        this.storage.setItem(key, value.toString());
        this.discoverDevices(0);
    }
}

export default new UnifiProtect();
