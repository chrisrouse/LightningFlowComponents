/**
 * Flow screen component. Exists only to give the property editor somewhere to
 * live — the bleed-through happens in Flow Builder's property panel, so it cannot
 * be reproduced outside one.
 */
import { LightningElement, api } from "lwc";

export default class BleedRepro extends LightningElement {
    @api label = "Bleed Repro";
}
