
import { patch } from "@web/core/utils/patch";
import { _t } from "@web/core/l10n/translation";
import { PosOrder } from "@point_of_sale/app/models/pos_order";

import { constructFullProductName, uuidv4 } from "@point_of_sale/utils";
import { Base } from "@point_of_sale/app/models/related_models";
import { parseFloat } from "@web/views/fields/parsers";
import { formatFloat, roundDecimals, roundPrecision, floatIsZero } from "@web/core/utils/numbers";
import { roundCurrency, formatCurrency } from "@point_of_sale/app/models/utils/currency";

import {
    getTaxesAfterFiscalPosition,
    getTaxesValues,
} from "@point_of_sale/app/models/utils/tax_utils";



patch(PosOrder.prototype, {

  get finalized() {
      return !["draft", "waiting"].includes(this.state);
  },


get_newUUID() {
  this.tracking_number =((this.session?.id % 10) * 100 + (this.sequence_number % 100)).toString();
  this.uuid = uuidv4();
},


});
