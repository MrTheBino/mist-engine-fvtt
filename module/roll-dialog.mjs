export class MistEngineRollDialog extends foundry.applications.api.DialogV2 {
    constructor(options = {}) {
        super(options);
    }

    _onRender(context, options) {
        super._onRender(context, options);

        const buttonNegativePlus = this.element.querySelector("#button-negative-plus");
        if(buttonNegativePlus){
            buttonNegativePlus.addEventListener("click", event => this._handleButtonNegativePlus(event));
        }

        const buttonNegativeMinus = this.element.querySelector("#button-negative-minus");
        if(buttonNegativeMinus){
            buttonNegativeMinus.addEventListener("click", event => this._handleButtonNegativeMinus(event));
        }

        const buttonPositivePlus = this.element.querySelector("#button-positive-plus");
        if(buttonPositivePlus){
            buttonPositivePlus.addEventListener("click", event => this._handleButtonPositivePlus(event));
        }

        const buttonPositiveMinus = this.element.querySelector("#button-positive-minus");
        if(buttonPositiveMinus){
            buttonPositiveMinus.addEventListener("click", event => this._handleButtonPositiveMinus(event));
        }
    }

    _handleButtonNegativePlus(event) {
        const input = this.element.querySelector("#negativeInput");
        input.stepUp();
    }

    _handleButtonNegativeMinus(event) {
        const input = this.element.querySelector("#negativeInput");
        input.stepDown();
    }

    _handleButtonPositivePlus(event) {
        const input = this.element.querySelector("#positiveInput");
        input.stepUp();
    }

    _handleButtonPositiveMinus(event) {
        const input = this.element.querySelector("#positiveInput");
        input.stepDown();
    }
}