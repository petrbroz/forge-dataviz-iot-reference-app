/**
 * Viewer extension for registering new IoT devices with the server-side
 * of the Hyperion Reference App.
 *
 * The extension adds a button to the toolbar which toggles a custom "Add Device" panel.
 * The panel then allows the user to enter device parameters such as device model ID,
 * or device ID, and submit these parameters to a preconfigured backend endpoint
 * so that the new device can be registered in one of the "gateways".
 */
export class DeviceExtension extends Autodesk.Viewing.Extension {
    constructor(viewer, options) {
        super(viewer, options);
        this.options.url = '/api/devices?provider=synthetic&project=unused'; // Change to any endpoint you need
        this._panel = null;
    }

    load() {
        console.log('DeviceExtension loaded.');
        return true;
    }

    unload() {
        console.log('DeviceExtension unloaded.');
        return true;
    }

    onToolbarCreated() {
        this._createUI();
    }

    _createUI() {
        // Add a new button to the toolbar that will toggle the "Add Device" panel
        this._group = this.viewer.toolbar.getControl('device-extension-group');
        if (!this._group) {
            this._group = new Autodesk.Viewing.UI.ControlGroup('device-extension-group');
            this.viewer.toolbar.addControl(this._group);
            this._button = new Autodesk.Viewing.UI.Button('add-device-button');
            this._group.addControl(this._button);
            this._button.setToolTip('Add Device');
            this._button.onClick = (ev) => {
                if (!this._panel) {
                    this._panel = new NewDevicePanel(this.viewer, 'new-device-panel', 'Add Device', this.options);
                }
                this._panel.setVisible(!this._panel.isVisible());
            };
        }
    }
}

/**
 * Custom viewer panel used to collect device parameters from the user,
 * and to submit the information to the configured backend URL.
 */
class NewDevicePanel extends Autodesk.Viewing.UI.DockingPanel {
    constructor(viewer, id, title, options) {
        super(viewer.container, id, title, options);
        this.viewer = viewer;
        this.container.style.height = 'auto';
        this.container.style.width = 'auto';
        this.container.style.resize = 'none';
        this.container.style.left = '40px';
        this.container.style.top = '120px';
        this.createScrollContainer(options);
        this.footer = this.createFooter();
        this.container.appendChild(this.footer);
        this.scrollContainer.innerHTML = `
            <div style="display: flex; flex-flow: column; margin: 1em;">
                <label for="deviceModelId">Device Model ID</label>
                <select name="deviceModelId" id="deviceModelId">
                    <option value="dm1">device-model-1</option>
                    <option value="dm2">device-model-2</option>
                    <option value="dm3">device-model-3</option>
                </select>
                <label for="deviceId">Device ID</label>
                <input type="text" id="deviceId">
                <label for="deviceName">Device Name</label>
                <input type="text" id="deviceName">
                <button id="submitBtn" style="margin-top: 1em;">Submit</button>
            </div>
        `;
        this.onViewerSelectionChanged();
        this.viewer.addEventListener(Autodesk.Viewing.SELECTION_CHANGED_EVENT, this.onViewerSelectionChanged.bind(this));
        document.getElementById('submitBtn').addEventListener('click', this.onSubmitButtonClick.bind(this));
    }

    // Enable/disable the submit button depending on what's selected in the viewer
    onViewerSelectionChanged() {
        const dbids = this.viewer.getSelection();
        if (dbids.length === 1) {
            document.getElementById('submitBtn').removeAttribute('disabled');
        } else {
            document.getElementById('submitBtn').setAttribute('disabled', 'true');
        }
    }

    // Handle the submit button click
    async onSubmitButtonClick() {
        try {
            // Compute the center point of what's selected (should be a single object)
            const dbids = this.viewer.getSelection();
            const tree = this.viewer.model.getInstanceTree();
            const frags = this.viewer.model.getFragmentList();
            let totalBounds = new THREE.Box3();
            let fragBounds = new THREE.Box3();
            tree.enumNodeFragments(dbids[0], (fragId) => {
                frags.getWorldBounds(fragId, fragBounds);
                totalBounds.union(fragBounds);
            }, true);
            const center = totalBounds.center();

            // Create a new device and submit it to the configured endpoint
            const device = {
                deviceModelId: document.getElementById('deviceModelId').value,
                deviceId: document.getElementById('deviceId').value,
                deviceName: document.getElementById('deviceName').value,
                positon: { x: center.x, y: center.y, z: center.z }
            };
            const resp = await fetch(this.options.url, {
                method: 'post',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(device)
            });
            if (!resp.ok) {
                throw new Error(await resp.text());
            } else {
                alert('New device has been successfully added.');
            }
        } catch (err) {
            alert('Could not add new device. See console for more details.');
            console.error(err);
        }
    }
}
