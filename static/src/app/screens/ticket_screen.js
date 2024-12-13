
import { patch } from "@web/core/utils/patch";
import { fuzzyLookup } from "@web/core/utils/search";
import { unaccent } from "@web/core/utils/strings";
import { _t } from "@web/core/l10n/translation";
import { parseUTCString } from "@point_of_sale/utils";

import { TicketScreen } from "@point_of_sale/app/screens/ticket_screen/ticket_screen";

const NBR_BY_PAGE = 30;

patch(TicketScreen.prototype, {

    setup() {
        super.setup(...arguments);
    },
    async _setOrder(order) {
        this.pos.selectedOrderUuid = order?.uuid;
        this.pos.set_order(order);
        this.closeTicketScreen();
    },

    async _setOrderPay(order) {
        this.pos.selectedOrderUuid = order?.uuid;
        this.pos.set_order(order);
        this.pos.pay();

    },

    async onFilterSelected(selectedFilter) {
        this.state.filter = selectedFilter;
        if (this.state.filter === "SYNCED" || this.state.filter === "WAITING") {
            await this._fetchSyncedOrders();
        }
    },

    async onSearch(search) {
        this.state.search = search;
        this.state.page = 1;
        if (this.state.filter === "SYNCED" || this.state.filter === "WAITING") {
            await this._fetchSyncedOrders();
        }
    },


    async _fetchSyncedOrders() {
      const screenState = this.pos.ticketScreenState;
      const domain = this._computeSyncedOrdersDomain();
      // const offset = screenState.offsetByDomain[JSON.stringify(domain)] || 0;
      const config_id = this.pos.config.id;
      const offset = (this.state.page - 1) * NBR_BY_PAGE;

      let methodName = "search_paid_order_ids";
      if (this.state.filter === "WAITING") {
          methodName = "search_waiting_order_ids";
      }
      const { ordersInfo, totalCount } = await this.pos.data.call(
          "pos.order",
          methodName,
          [],
          {
              config_id,
              domain,
              limit: 30,
              offset,
          }
      );
      // Actualizar el estado de la paginación
      if (!screenState.offsetByDomain[JSON.stringify(domain)]) {
          screenState.offsetByDomain[JSON.stringify(domain)] = 0;
      }
      // Incrementar el offset con base en el número de órdenes obtenidas
      screenState.offsetByDomain[JSON.stringify(domain)] += ordersInfo.length;
      screenState.totalCount = totalCount;

      if (ordersInfo.length > 0) {
        await this.pos.data.read("pos.order", ordersInfo.map((orderInfo) => orderInfo[0]));
      }
    },

    getStatus(order) {
      if (
          order.uiState?.locked &&
          (order.get_screen_data().name === "" || this.state.filter === "SYNCED" || this.state.filter === "WAITING")
      ) {
          if (this.state.filter === "SYNCED") {
              return _t("Paid");
          } else if (this.state.filter === "WAITING") {
              return _t("Waiting");
          }
      } else {
          const screen = order.get_screen_data();
          return this._getOrderStates().get(this._getScreenToStatusMap()[screen.name])?.text;
      }
    },
    getFilteredOrderList() {
      const orderModel = this.pos.models["pos.order"];
      let orders;
      // Verificamos si existe 'pos_receiver' en la configuración de pos
      if (this.pos.config.pos_receiver) {
          // Si 'filter' es null, lo establecemos en "WAITING"
          if (this.state.filter == null) {
              this.state.filter = "WAITING";
          }
      }
      if (this.state.filter === "SYNCED") {
          orders = orderModel.filter((o) => o.finalized && o.uiState.displayed);
      } else if (this.state.filter === "WAITING") {
          // Aquí asumiendo que las órdenes en espera se marcan de alguna forma.
          // Podrías tener una propiedad en las órdenes para identificar las que están 'waiting'.
          // Por ejemplo, si la orden tiene un campo order.state === 'waiting':
          orders = orderModel.filter((o) => o.state === 'waiting' && o.uiState.displayed);
      } else {
          orders = orderModel.filter(this.activeOrderFilter);
      }

      if (this.state.filter && !["ACTIVE_ORDERS", "SYNCED", "WAITING"].includes(this.state.filter)) {
          orders = orders.filter((order) => {
              const screen = order.get_screen_data();
              return this._getScreenToStatusMap()[screen.name] === this.state.filter;
          });
      }

      if (this.state.search.searchTerm) {
          const repr = this._getSearchFields()[this.state.search.fieldName].repr;
          orders = fuzzyLookup(this.state.search.searchTerm, orders, repr);
      }
      const sortOrders = (orders, ascending = false) => {
          return orders.sort((a, b) => {
              const dateA = parseUTCString(a.date_order, "yyyy-MM-dd HH:mm:ss");
              const dateB = parseUTCString(b.date_order, "yyyy-MM-dd HH:mm:ss");

              if (a.date_order !== b.date_order) {
                  return ascending ? dateA - dateB : dateB - dateA;
              } else {
                  const nameA = parseInt(a.name.replace(/\D/g, "")) || 0;
                  const nameB = parseInt(b.name.replace(/\D/g, "")) || 0;
                  return ascending ? nameA - nameB : nameB - nameA;
              }
          });
      };

      if (this.state.filter === "SYNCED" || this.state.filter === "WAITING") {
          return sortOrders(orders).slice(
              (this.state.page - 1) * NBR_BY_PAGE,
              this.state.page * NBR_BY_PAGE
          );
      } else {
          return sortOrders(orders, true);
      }
    },

    _getFilterOptions() {

      const orderStates = this._getOrderStates();
      // Añadir WAITING si pos_receiver es true (o si deseas mostrar siempre)
      if (this.pos.config.pos_receiver) {
          orderStates.set("WAITING", { text: _t("Waiting") });
      }
      orderStates.set("SYNCED", { text: _t("Paid") });

      return orderStates;
    },

    _getOrderStates() {
        // We need the items to be ordered, therefore, Map is used instead of normal object.
        const states = new Map();
        if (!this.pos.config.pos_receiver) {

        states.set("ACTIVE_ORDERS", {
            text: _t("All active orders"),
        });
        // The spaces are important to make sure the following states
        // are under the category of `All active orders`.
        states.set("ONGOING", {
            text: _t("Ongoing"),
            indented: true,
        });
        states.set("PAYMENT", {
            text: _t("Payment"),
            indented: true,
        });
        states.set("RECEIPT", {
            text: _t("Receipt"),
            indented: true,
        });
      }
      return states;
    }

});
