import { randomBackground } from "../utils/random.js"
import { iniciarLayout } from "./layout.js"

iniciarLayout()

document.addEventListener("DOMContentLoaded", randomBackground)