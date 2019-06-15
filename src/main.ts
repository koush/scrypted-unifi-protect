import sdk, { ScryptedDeviceBase, DeviceProvider, Settings, Setting, ScryptedDeviceType, VideoCamera, MediaObject } from "@scrypted/sdk";
const { log, deviceManager, mediaManager } = sdk;

class RtspCamera extends ScryptedDeviceBase implements VideoCamera, Settings {

    constructor(nativeId: string) {
        super(nativeId);
    }
    getVideoStream(): MediaObject {
        var url = this.storage.getItem("url");
        if (!url) {
            return null;
        }
        // mime type will be inferred from the rtsp scheme, and null may be passed.
        return mediaManager.createMediaObject(url, null);
    }
    getSetting(key: string): string | number {
        return this.storage.getItem(key);
    }
    getSettings(): Setting[] {
        return [
            {
                key: 'url',
                title: 'RTSP Stream URL',
                placeholder: 'rtsp://192.168.1.100:4567/foo/bar',
                value: this.getSetting('url'),
            },
            {
                key: 'username',
                title: 'Username',
                value: this.getSetting('username'),
            },
            {
                key: 'password',
                title: 'Password',
                value: this.getSetting('password'),
            },
        ];
    }
    putSetting(key: string, value: string | number): void {
        this.storage.setItem(key, value.toString());
    }
}

class RtspProvider extends ScryptedDeviceBase implements DeviceProvider, Settings {
    getSetting(key: string): string | number {
        return null;
    }
    getSettings(): Setting[] {
        return [
            {
                key: 'new-camera',
                title: 'Add RTSP Camera',
                placeholder: 'Camera name, e.g.: Back Yard Camera, Baby Camera, etc',
            }
        ]
    }
    putSetting(key: string, value: string | number): void {
            // generate a random id
        var nativeId = Math.random().toString();
        var name = value.toString();

        deviceManager.onDeviceDiscovered({
            nativeId,
            name: name,
            interfaces: ["VideoCamera", "Settings"],
            type: ScryptedDeviceType.Camera,
        });

        var camera = new RtspCamera(nativeId);
        var text = `New RTSP Camera ${name} ready. Check the notification area to complete setup.`;
        log.a(text);
        log.clearAlert(text);
    }
    discoverDevices(duration: number): void {
    }

    getDevice(nativeId: string): object {
        return new RtspCamera(nativeId);
    }
}

export default new RtspProvider();