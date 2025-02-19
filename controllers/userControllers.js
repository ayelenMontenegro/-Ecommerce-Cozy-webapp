const User = require("../models/User")
const bcryptjs = require("bcryptjs")
const jwt = require("jsonwebtoken")
const wrapedSendMail = require("../config/sendMail")
const handleError = (res, err) => {
  res.json({ success: false, response: err.message })
}
const userControllers = {
  registerUser: (req, res) => {
    const {
      lastName,
      firstName,
      password,
      eMail,
      google,
      photo,
      admin,
      secretWord,
      native
    } = req.body
    let owner = false
    let photoUploaded = ""
    let fileName = ""
    try {
      if (!req.files && !google && !native) throw new Error("Must upload a photo")
      if (req.files) {
        photoUploaded = req.files.photo
      }
      if (admin == "true") {
        if (secretWord === process.env.SECRETWORDOWNER) {
          owner = secretWord === process.env.SECRETWORDOWNER
        } else {
          throw new Error("Can't be admin")
        }
      }
      let hashedPass = bcryptjs.hashSync(password)
      const newUser = new User({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        password: hashedPass,
        eMail,
        google,
        admin,
        owner,
        photo: (google || native) ? photo : "",
        photoNativeColor: native ? `rgb(${Math.random()*200},${Math.random()*200},${Math.random()*200})` : null,
        native: native ? native : false
      })
      if (google == "false") {
        fileName =
          newUser._id +
          "." +
          photoUploaded.name.split(".")[
            photoUploaded.name.split(".").length - 1
          ]
        newUser.photo = fileName
        photoUploaded.mv(`${__dirname}/../storage/${fileName}`)
      }
      newUser
        .save()
        .then((user) => {
          const token = jwt.sign({ ...newUser }, process.env.SECRETORKEY)
          req.session.loggedUser = newUser
          res.json({
            success: true,
            response: {
              photo: user.photo,
              token,
              firstName: user.firstName,
              lastName: user.lastName,
              eMail: user.eMail,
              admin: user.admin,
              owner: user.owner,
              native: user.native ? user.native : false,
              photoNativeColor: user.photoNativeColor ? user.photoNativeColor : false
            },
          })
        })
        .catch((err) =>
          res.json({
            success: false,
            response: err.message.includes("duplicate key")
              ? "eMail already in use"
              : err.message,
          })
        )
    } catch (err) {
      res.json({ success: false, response: err.message })
    }
  },
  logUser: (req, res) => {
    const errMessage = "Invalid username or pass"
    const { eMail, password, google } = req.body
    User.exists({ eMail: eMail })
      .then((exists) => {
        if (exists) {
          User.findOne({ eMail: eMail })
            .then((userFound) => {
              if (userFound.google === true && google === false) {
                throw new Error("Log in with Google!")
              }
              if (!bcryptjs.compareSync(password, userFound.password))
                throw new Error(errMessage)
              const token = jwt.sign({ ...userFound }, process.env.SECRETORKEY)
              req.session.loggedUser = userFound
              res.json({
                success: true,
                response: {
                  photo: userFound.photo,
                  token,
                  firstName: userFound.firstName,
                  lastName: userFound.lastName,
                  eMail: userFound.eMail,
                  admin: userFound.admin,
                  owner: userFound.owner,
                  native: userFound.native ? userFound.native : false,
                  photoNativeColor: userFound.photoNativeColor ? userFound.photoNativeColor : false
                },
              })
            })
            .catch((err) => handleError(res, err))
        } else {
          throw new Error(errMessage)
        }
      })
      .catch((err) => handleError(res, err))
  },
  logFromSession: async (req, res) => {
    try {
      if (!req.session.loggedUser) throw new Error("Bad Session, Log In First")
      const user = req.session.loggedUser
      let userFound = await User.findOne({ _id: user._id })
      if (userFound) {
        const token = jwt.sign({ ...userFound }, process.env.SECRETORKEY)
        req.session.loggedUser = userFound
        res.json({
          success: true,
          response: {
            lastName: userFound.lastName,
            eMail: userFound.eMail,
            photo: userFound.photo,
            token,
            firstName: userFound.firstName,
            admin: userFound.admin,
            owner: userFound.owner,
            native: userFound.native ? userFound.native : false,
            photoNativeColor: userFound.photoNativeColor ? userFound.photoNativeColor : false
          },
        })
      } else {
        throw new Error("User not found")
      }
    } catch (err) {
      req.session.destroy(() => {
        res.json({ success: false, response: err.message }) // hacerlo deslogear en redux
      })
    }
  },
  logOut: async (req, res) => {
    try {
      req.session.destroy(() => {
        res.json({ success: true })
      })
    } catch (err) {
      res.json({ success: false, response: err.message })
    }
  },
  manageAdmin: async (req, res) => {
    try {
      if (!req.session.loggedUser) throw new Error("Log In First")
      const user = req.session.loggedUser
      if (!user.owner) throw new Error("You don't have permission to do that")
      const { userToChange, actionToDo } = req.body
      let userFound = await User.findOneAndUpdate(
        { _id: userToChange },
        { admin: actionToDo }
      )
      if (!userFound) throw new Error("User not found")
      res.json({ success: true })
    } catch (err) {
      res.json({ success: false, response: err.message })
    }
  },
  manageUser: async (req, res) => {
    try {
      if (!req.session.loggedUser) throw new Error("Log In First")
      const user = req.session.loggedUser
      const { password, zipcode, number, city, street, phone, dni } = req.body
      let info = {
        zipcode,
        address: {
          number,
          city,
          street,
        },
        phone,
        dni,
      }
      let hashedPass = user.password
      if (password) {
        hashedPass = bcryptjs.hashSync(password)
      }
      let userFound = await User.findOneAndUpdate(
        { _id: user._id },
        { info, password: hashedPass },
        { new: true }
      )
      if (!userFound) throw new Error("User not found")
      req.session.loggedUser = userFound
      res.json({ success: true, response: userFound })
    } catch (err) {
      res.json({ success: false, response: err.message })
    }
  },
  getUsers: async (req, res) => {
    try {
      if (!req.session.loggedUser) throw new Error("Log In First")
      if (!req.session.loggedUser.owner)
        throw new Error("You don't have permissions to do this")
      let users = await User.find().select({ _id: 1, eMail: 1, admin: 1 })
      res.json({ success: true, response: users })
    } catch (err) {
      res.json({ success: false, response: err.message })
    }
  },
  removeUser: async (req, res) => {
    try {
      if (!req.session.loggedUser) throw new Error("Log In First")
      if (!req.session.loggedUser.owner)
        throw new Error("You don't have permissions to do this")
      const userToDelete = req.params.id
      let userDeleted = await User.findOneAndDelete({ _id: userToDelete })
      if (!userDeleted) throw new Error("User not found")
      res.json({ success: true, response: userDeleted })
    } catch (err) {
      res.json({ success: false, response: err.message })
    }
  },
  sendResetPasswordMail: (req, res) => {
    const { eMail } = req.body
    User.findOne({ eMail: eMail })
      .then(async (user) => {
        if (user) {
          let message = `
                    <table style="max-width: 700px; padding: 10px; margin:0 auto; border-collapse: collapse;">
                        <div style="width: 100%;margin:20px 0; text-align: center;">
                            <img src="https://cozydeco.herokuapp.com/c.png" style="width: 100px;"/>
                        </div>
                        <tr>
                            <td style="background-color: #F0F3F5">
                                <div style="color: #34495e; margin: 4% 10% 2%; text-align: justify;font-family: sans-serif">
                                    <h1 style="color: #dabea8; margin: 0 0 7px">Hello!</h1>
                                    <h2 style="color: #000; margin: 0 0 7px">Dear ${user.firstName} ${user.lastName}:</h2>
                                    <p style="margin: 2px; font-size: 15px; color: #000">
                                            We sent you this e-mail to confirm that you want to change your password!<br>
                                    </p>
                                    <h2 style="color: #dabea8;">Details of your Account:</h2>
                                    <ul style="font-size: 15px;  margin: 10px 0">
                                        <li style="color: #000;">First Name: ${user.firstName}</li>
                                        <li style="color: #000;">Last Name: ${user.lastName}</li>
                                        <li style="color: #000;">Email: ${user.eMail}</li>
                                        <a href="https://cozydecodesign.herokuapp.com/user/resetpassword/${user._id}" style="font-size:25px;color: #000;text-align:center;display:block;">CHANGE YOUR PASSWORD!</a>
                                    </ul>
                                    <h2 style="color: #dabea8;">IMPORTANT INFORMATION - PROTECT YOUR ACCOUNT:</h2>
                                    <p style="margin: 2px; font-size: 15px; color: #000">
                                        Our website encrypt your password to protect your information, but even if we do that, is your responsability to protect your account using a secure password, here are some tips to do so:
                                    </p>
                                    <ul style="font-size: 15px;  margin: 10px 0; color: #000">
                                        <li>Use non easy to guess combinations (for example don't use birthdays)</li>
                                        <li>Use symbols, numbers and / or uppercase letters.</li>
                                        <li>Don't tell anyone your password.</li>
                                        <li>NO ONE will ask from this company your password to assist you.</li>
                                    </ul>
                                    <h2 style="margin: 0 0 7px; color: #dabea8">Also:</h2>
                                    <p style="margin: 2px; font-size: 15px; color: #000;">
                                        If you didn't request a password change, dismiss this email.
                                    </p>
                                    <div style="width: 100%;margin:20px 0; display: inline-block;text-align: center; background-color: #dabea8;">
                                    <a style="text-decoration: none; color: white;" href=""><p style="color: #fff; font-size: 14px; text-align: center;">© Copyright 2021 | Cozy Deco.</p></a>	
                                </div>
                            </td>
                        </tr>
                    </table>
                `
          let mailOptions = {
            from: "Cozy <cozydecodesign@gmail.com>",
            to: `${user.firstName} <${user.eMail}>`,
            subject: `Password Reset ${user.firstName}!`,
            html: message,
          }
          let mailResp = await wrapedSendMail(mailOptions);
          if(!mailResp)throw new Error('Password changed changed but email did not send')
          res.json({success: true, response: 'Password changed and email sent'})
          transport.sendMail(mailOptions, (err, data) => {
            err
              ? res.json({ success: false, response: err })
              : res.json({ success: true, response: data })
          })
        } else {
          throw new Error("User not found")
        }
      })
      .catch((err) => handleError(res, err))
  },
  resetUserPassword: (req, res) => {
    const { password } = req.body
    let hashedPass = bcryptjs.hashSync(password)
    User.findOneAndUpdate({ _id: req.params.id }, { password: hashedPass })
      .then(async (user) => {
        if (user) {
          let message = `
                    <table style="max-width: 700px; padding: 10px; margin:0 auto; border-collapse: collapse;">
                        <div style="width: 100%;margin:20px 0; text-align: center;">
                            <img src="https://cozydeco.herokuapp.com/c.png" style="width: 100px;"/>
                        </div>
                        <tr>
                            <td style="background-color: #F0F3F5">
                                <div style="color: #34495e; margin: 4% 10% 2%; text-align: justify;font-family: sans-serif">
                                    <h1 style="color: #dabea8; margin: 0 0 7px">Hello!</h1>
                                    <h2 style="color: #000; margin: 0 0 7px">Dear ${user.firstName} ${user.lastName}:</h2>
                                    <p style="margin: 2px; font-size: 15px; color: #000">
                                            We sent you this e-mail to confirm that your password has changed!<br>
                                    </p>
                                    <h2 style="color: #dabea8;">Details of your Account:</h2>
                                    <ul style="font-size: 15px;  margin: 10px 0">
                                        <li style="color: #000;">First Name: ${user.firstName}</li>
                                        <li style="color: #000;">Last Name: ${user.lastName}</li>
                                        <li style="color: #000;">Email: ${user.eMail}</li>
                                    </ul>
                                    <h2 style="color: #dabea8;">IMPORTANT INFORMATION - PROTECT YOUR ACCOUNT:</h2>
                                    <p style="margin: 2px; font-size: 15px; color: #000">
                                        Our website encrypt your password to protect your information, but even if we do that, is your responsability to protect your account using a secure password, here are some tips to do so:
                                    </p>
                                    <ul style="font-size: 15px;  margin: 10px 0; color: #000">
                                        <li>Use non easy to guess combinations (for example don't use birthdays)</li>
                                        <li>Use symbols, numbers and / or uppercase letters.</li>
                                        <li>Don't tell anyone your password.</li>
                                        <li>NO ONE will ask from this company your password to assist you.</li>
                                    </ul>
                                    <h2 style="margin: 0 0 7px; color: #dabea8">Cozy Deco:</h2>
                                    <p style="margin: 2px; font-size: 15px; color: #000;">
                                        Best regards.
                                    </p>
                                    <div style="width: 100%;margin:20px 0; display: inline-block;text-align: center; background-color: #dabea8;">
                                    <a style="text-decoration: none; color: white;" href=""><p style="color: #fff; font-size: 14px; text-align: center;">© Copyright 2021 | Cozy Deco.</p></a>	
                                </div>
                            </td>
                        </tr>
                    </table>
                `
          let mailOptions = {
            from: "Cozy <cozydecodesign@gmail.com>",
            to: `${user.firstName} <${user.eMail}>`,
            subject: `Password changed ${user.firstName}!`,
            html: message,
          }
          let mailResp = await wrapedSendMail(mailOptions);
          if(!mailResp)throw new Error('Password changed changed but email did not send')
          res.json({success: true, response: 'Password changed and email sent'})
        } else {
          throw new Error("User not found")
        }
      })
      .catch((err) => handleError(res, err))
  },
}
module.exports = userControllers
