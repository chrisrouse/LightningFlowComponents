/**
 * Repro: `lightning-datatable`'s row number column clips its own digits.
 *
 * DELIBERATELY SALESFORCE'S OWN EXAMPLE and nothing else -- the markup, the columns
 * and `generateData` are copied from the lightning-datatable documentation. No Flow
 * Grid code is involved, so if this clips on an LWR site the platform owns it.
 *
 * See README.md for the measurements and the cause.
 */
import { LightningElement } from "lwc";
import generateData from "./generateData";

const columns = [
    { label: "Label", fieldName: "name" },
    { label: "Website", fieldName: "website", type: "url" },
    { label: "Phone", fieldName: "phone", type: "phone" },
    { label: "Balance", fieldName: "amount", type: "currency" },
    { label: "CloseAt", fieldName: "closeAt", type: "date" }
];

export default class ReproRowNumber extends LightningElement {
    data = [];
    columns = columns;
    rowOffset = 0;

    connectedCallback() {
        this.data = generateData({ amountOfRecords: 100 });
    }

    increaseRowOffset() {
        this.rowOffset += 100;
    }
}
