import { ProductProduct } from "@point_of_sale/app/models/product_product";
import { patch } from "@web/core/utils/patch";

patch(ProductProduct.prototype, {

    get searchStringNew() {
        const fields = ["display_name", "description_sale", "description", "default_code","product_barcodes"];
        return fields
            .map((field) => this[field] || "")
            .filter(Boolean)
            .join(" ");
    }
});
