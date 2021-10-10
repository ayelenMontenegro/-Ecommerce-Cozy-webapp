import { useState } from "react"
import styles from "../styles/PaymentGateway.module.css"
import { connect } from "react-redux"
import userActions from "../redux/actions/userActions"
import cartActions from "../redux/actions/cartActions"
import Paypal from "../components/Paypal"
import MercadoPagoForm from "../components/MercadoPago/MercadoPagoForm"
import GiftCard from "../components/GiftCard"

//VENDEDOR
//sb-imkhe8058198@business.example.com
//<g/2#2wF

//COMPRADOR
//sb-dfobu8056038@personal.example.com
//s7%C68F#

//CLIENT ID
//AWRVu1dvYAIDrl-vZ5_ST31KBhCxaoAr8-IIsNOYSwlWwMJBoUGiEsrc5H9dLg5DAoWyrhsjE3-UqEMw

const PaymentGateway = ({
  loginUser,
  products,
  manageUser,
  addNewOrder,
  history,
  addCard,
  getCard,
}) => {
  const [sharedPayment, setSharedPayment] = useState(false)
  const [code, setCode] = useState(null)
  const [balance, setBalance] = useState(null)
  const [hideRadio, setHideRadio] = useState(true)
  const [enableInput, setEnableInput] = useState(false)
  const [enablePayment, setEnablePayment] = useState(true)
  const [renderError, setRenderError] = useState(null)
  const [chosenMethod, setChosenMethod] = useState({
    type: null,
    enable: false,
  })
  const [info, setInfo] = useState({
    zipCode: "",
    number: "",
    city: "",
    street: "",
    phone: "",
    dni: "",
    firstName: loginUser.firstName,
    lastName: loginUser.lastName,
    eMail: loginUser.eMail,
  })

  const validateGift = products.filter(
    (obj) => obj.product.category === "GiftCard"
  )

  if (validateGift.length) {
    var giftCard = validateGift.map((obj) => ({ balance: obj.product.price }))
  }
  console.log(validateGift)
  console.log(giftCard)
  const validate = () => {
    setHideRadio(false)
    setEnableInput(true)
    setEnablePayment(true)
    if (Object.values(info).some((value) => value === !value)) {
      setRenderError(
        "necesitas completar todos los campos para continuar con el pago"
      )
      alert("completar campos")
    } else {
      manageUser(info).then((res) => {
        if (res.success) {
          setChosenMethod({ ...chosenMethod, enable: true })
        } else {
          alert("ERROR")
        }
      })
    }
  }

  const totalPrice = products.map((obj) =>
    obj.product.discount === 0
      ? obj.product.price * obj.quantity
      : ((100 - obj.product.discount) / 100) * obj.product.price * obj.quantity
  )

  const [order, setOrder] = useState({
    products: products.map((obj) => ({
      productId: obj.product._id,
      quantity: obj.quantity,
    })),
    paymentMethod: {
      type: "",
      extraInfo: "",
    },
    totalPrice: totalPrice.reduce((a, b) => a + b, 0).toFixed(2),
  })

  const sideProducts = products.map((obj) => {
    return (
      <div key={obj.product._id} className={styles.productInCart}>
        <div
          className={styles.productCartPhoto}
          style={{
            backgroundImage: `url("${
              obj.product.photo.includes("http")
                ? obj.product.photo
                : `http://localhost:4000/${obj.product.photo}`
            }")`,
          }}
        ></div>
        <p>{obj.product.name}</p>
        <div className={styles.productCartInfo}>
          <div>
            <p>{obj.quantity} X </p>

            <p>
              $
              {obj.product.discount === 0
                ? obj.product.price
                : (
                    ((100 - obj.product.discount) / 100) *
                    obj.product.price
                  ).toFixed(2)}
            </p>
            <p>
              $
              {(
                (obj.product.discount === 0
                  ? obj.product.price
                  : ((100 - obj.product.discount) / 100) * obj.product.price) *
                obj.quantity
              ).toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    )
  })
  const fillUserInfo = (e) => {
    setInfo({
      ...info,
      [e.target.name]: e.target.value,
    })
  }

  const fillOrderInfo = (e, add) => {
    setOrder({
      ...order,
      paymentMethod: {
        ...order.paymentMethod,
        type: !add
          ? e.target.value
          : `${order.paymentMethod.type} - ${e.target.value}`,
      },
    })
    setChosenMethod({
      ...chosenMethod,
      type: !add ? e.target.value : `${chosenMethod.type} - ${e.target.value}`,
    })
    add && setSharedPayment(true)
  }

  console.log(order)
  const addNewOrderHandler = () => {
    if (giftCard) {
      addCard(...giftCard).then((res) => console.log(res))
    }
    addNewOrder(order).then((res) => {
      if (res.success) {
        localStorage.removeItem("cart")
        //MANDAR ACTION PARA LIMPIAR CARRITO EN STORE REDUX
        history.push("/")
      } else {
        alert("algo fue mal con el pago")
      }
    })
  }

  let date = new Date()

  const fillCode = (e) => {
    setCode({ code: e.target.value })
  }
  const getCardHandler = () => {
    getCard(code).then((res) => {
      if (res.success) {
        setBalance(res.res.balance)
      } else {
        setBalance("Tu tarjeta no es valida")
      }
    })
  }

  const checkBalance =
    typeof balance === "number" ? balance - order.totalPrice : null
  const sharedPaymentPrice = Math.abs(checkBalance)
  // console.log(order)
  console.log(String(sharedPaymentPrice))
  return (
    <div className={styles.gatewayContainer}>
      <div className={styles.clientInfo}>
        <div className={styles.personalInfo}>
          <h1>Personal Info</h1>
          <label>Email</label>
          <input
            type="text"
            required
            name="eMail"
            defaultValue={info.eMail}
            disabled
          />
          <div>
            <label>Name</label>
            <input
              type="text"
              required
              name="firstName"
              defaultValue={info.firstName}
              disabled
            />
            <label>Lastname</label>
            <input
              type="text"
              required
              name="lastName"
              defaultValue={info.lastName}
              disabled
            />
          </div>
          <div>
            <label>DNI</label>
            <input
              type="text"
              required
              name="dni"
              defaultValue={info.dni}
              onChange={fillUserInfo}
              disabled={enableInput}
            />
            <label>Phone Number</label>
            <input
              type="text"
              required
              name="phone"
              defaultValue={info.phone}
              onChange={fillUserInfo}
              disabled={enableInput}
            />
          </div>
        </div>
        <div className={styles.shipmentInfo}>
          <h1>Shipment Info</h1>
          <div>
            <label>Calle</label>
            <input
              type="text"
              required
              name="street"
              defaultValue={info.street}
              onChange={fillUserInfo}
              disabled={enableInput}
            />

            <label>Number - piso/depto:</label>
            <input
              type="text"
              required
              name="number"
              defaultValue={info.number}
              onChange={fillUserInfo}
              disabled={enableInput}
            />
          </div>
          <div>
            <label>Ciudad</label>
            <input
              type="text"
              required
              name="city"
              defaultValue={info.city}
              onChange={fillUserInfo}
              disabled={enableInput}
            />
            <label>Zip Code</label>
            <input
              type="text"
              required
              name="zipCode"
              defaultValue={info.zipCode}
              onChange={fillUserInfo}
              disabled={enableInput}
            />
          </div>

          <div>
            <h1>Payment</h1>
            {hideRadio && (
              <div className={styles.switchField}>
                <input
                  type="radio"
                  id="paypal"
                  name="payMethod"
                  defaultValue="paypal"
                  onChange={fillOrderInfo}
                  onClick={() => setEnablePayment(false)}
                  disabled={enableInput}
                />
                <label for="paypal">Paypal</label>
                <input
                  type="radio"
                  id="mercadopago"
                  name="payMethod"
                  defaultValue="mercadoPago"
                  onChange={fillOrderInfo}
                  onClick={() => setEnablePayment(false)}
                  disabled={enableInput}
                />
                <label for="mercadopago">Credit/Debit Card</label>
                <input
                  type="radio"
                  id="giftcard"
                  name="payMethod"
                  defaultValue="giftCard"
                  onChange={fillOrderInfo}
                  onClick={() => setEnablePayment(false)}
                  disabled={enableInput}
                />
                <label for="giftcard">Gift Card</label>
              </div>
            )}
          </div>
        </div>
        <button disabled={enablePayment} onClick={validate}>
          Completar Pago
        </button>
        {chosenMethod.enable && chosenMethod.type.includes("giftCard") && (
          <div>
            <label>Enter your Giftcard Code</label>
            <input
              type="text"
              required
              name="giftCardCode"
              defaultValue=" "
              onChange={fillCode}
            />
            <button onClick={getCardHandler}>Check balance</button>
            {typeof balance === "string" && <p>{balance}</p>}
            {typeof balance === "number" && (
              <p>el saldo de tu giftcard es de ${balance}</p>
            )}
            {checkBalance < 0 && (
              <div className={styles.switchField}>
                <p>
                  el valor de tu compra ${order.totalPrice} supera el saldo que
                  tienes en tu giftcard, el saldo que queda por pagar es de $
                  {Math.abs(checkBalance)}.
                </p>
                <input
                  type="radio"
                  id="paypal"
                  name="payMethod"
                  defaultValue="paypal"
                  onChange={(e) => fillOrderInfo(e, "add")}
                  onClick={() => setEnablePayment(false)}
                  disabled={sharedPayment}
                />
                <label for="paypal">Paypal</label>
                <input
                  type="radio"
                  id="mercadopago"
                  name="payMethod"
                  defaultValue="mercadoPago"
                  onChange={(e) => fillOrderInfo(e, "add")}
                  onClick={() => setEnablePayment(false)}
                  disabled={sharedPayment}
                />
                <label for="mercadopago">Credit/Debit Card</label>
              </div>
            )}
          </div>
        )}

        {chosenMethod.enable && chosenMethod.type.includes("paypal") && (
          <Paypal
            description={`Cozy  ${date.toLocaleDateString()}`}
            total={!sharedPayment ? order.totalPrice : sharedPaymentPrice}
            order={order}
            info={info}
          />
        )}
        {chosenMethod.enable && chosenMethod.type.includes("mercadoPago") && (
          <MercadoPagoForm
            addNewOrderHandler={addNewOrderHandler}
            total={String(sharedPaymentPrice)}
          />
        )}
      </div>
      <div>
        <h1>Shopping Cart</h1>
        {sideProducts}
      </div>
    </div>
  )
}

const mapStateTopProps = (state) => {
  return {
    products: state.cart.products,
    loginUser: state.users.user,
  }
}

const mapDispatchToProps = {
  manageUser: userActions.manageUser,
  addNewOrder: cartActions.addNewOrder,
  addCard: cartActions.addCard,
  getCard: cartActions.getCard,
}

export default connect(mapStateTopProps, mapDispatchToProps)(PaymentGateway)
