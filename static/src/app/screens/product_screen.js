
import { patch } from "@web/core/utils/patch";
import { fuzzyLookup } from "@web/core/utils/search";
import { unaccent } from "@web/core/utils/strings";
import { ProductScreen } from "@point_of_sale/app/screens/product_screen/product_screen";


patch(ProductScreen.prototype, {

    setup() {
        super.setup(...arguments);
    },

    getProductsBySearchWordNew(searchWord) {
        return optimizedSearch(
            unaccent(searchWord, false),
            this.products,
            (product) => unaccent(product.searchString, false)
        );
    },

});
