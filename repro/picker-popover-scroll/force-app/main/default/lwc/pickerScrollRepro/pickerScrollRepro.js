/**
 * Flow screen component. Exists only to give the property editor somewhere to live.
 */
import { LightningElement, api } from "lwc";

export default class PickerScrollRepro extends LightningElement {
    @api resourceValue;
}
