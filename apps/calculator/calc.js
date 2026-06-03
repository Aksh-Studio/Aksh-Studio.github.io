class Calculator {
    constructor(previousOperandTextElement, currentOperandTextElement) {
        this.previousOperandTextElement = previousOperandTextElement;
        this.currentOperandTextElement = currentOperandTextElement;
        this.clear();
    }

    clear() {
        this.currentOperand = '0';
        this.previousOperand = '';
        this.operation = undefined;
    }

    delete() {
        if (this.currentOperand === '0') return;
        this.currentOperand = this.currentOperand.toString().slice(0, -1);
        if (this.currentOperand === '') this.currentOperand = '0';
    }

    appendNumber(number) {
        if (number === '.' && this.currentOperand.includes('.')) return;
        if (this.currentOperand === '0' && number !== '.') {
            this.currentOperand = number.toString();
        } else {
            this.currentOperand = this.currentOperand.toString() + number.toString();
        }
    }

    appendConstant(constant) {
        if (constant === 'pi') this.currentOperand = Math.PI.toString();
        if (constant === 'e') this.currentOperand = Math.E.toString();
    }

    computeSingleOperand(operation) {
        let current = parseFloat(this.currentOperand);
        if (isNaN(current)) return;

        switch (operation) {
            case 'sin': current = Math.sin(current); break; // Assumes radians for standard sci calc
            case 'cos': current = Math.cos(current); break;
            case 'tan': current = Math.tan(current); break;
            case 'sqrt': current = Math.sqrt(current); break;
            case 'log': current = Math.log10(current); break;
            case 'ln': current = Math.log(current); break;
            case '1/x': current = 1 / current; break;
            case 'abs': current = Math.abs(current); break;
        }
        
        // Fix floating point errors
        this.currentOperand = (Math.round(current * 1e10) / 1e10).toString();
    }

    chooseOperation(operation) {
        if (this.currentOperand === '0' && this.previousOperand === '') return;
        if (this.previousOperand !== '') {
            this.compute();
        }
        this.operation = operation;
        this.previousOperand = this.currentOperand;
        this.currentOperand = '0';
    }

    compute() {
        let computation;
        const prev = parseFloat(this.previousOperand);
        const current = parseFloat(this.currentOperand);
        
        if (isNaN(prev) || isNaN(current)) return;
        
        switch (this.operation) {
            case '+': computation = prev + current; break;
            case '−': computation = prev - current; break;
            case '×': computation = prev * current; break;
            case '÷': 
                if (current === 0) { alert("Cannot divide by zero"); return this.clear(); }
                computation = prev / current; break;
            case '^': computation = Math.pow(prev, current); break;
            default: return;
        }
        
        this.currentOperand = (Math.round(computation * 1e10) / 1e10).toString();
        this.operation = undefined;
        this.previousOperand = '';
    }

    getDisplayNumber(number) {
        const stringNumber = number.toString();
        const integerDigits = parseFloat(stringNumber.split('.')[0]);
        const decimalDigits = stringNumber.split('.')[1];
        let integerDisplay;
        if (isNaN(integerDigits)) {
            integerDisplay = '';
        } else {
            integerDisplay = integerDigits.toLocaleString('en', { maximumFractionDigits: 0 });
        }
        if (decimalDigits != null) {
            return `${integerDisplay}.${decimalDigits}`;
        } else {
            return integerDisplay;
        }
    }

    updateDisplay() {
        this.currentOperandTextElement.innerText = this.getDisplayNumber(this.currentOperand);
        if (this.operation != null) {
            this.previousOperandTextElement.innerText = `${this.getDisplayNumber(this.previousOperand)} ${this.operation}`;
        } else {
            this.previousOperandTextElement.innerText = '';
        }
    }
}

const calculator = new Calculator(
    document.querySelector('[data-previous-operand]'),
    document.querySelector('[data-current-operand]')
);

// Event Listeners
document.querySelectorAll('[data-number]').forEach(button => {
    button.addEventListener('click', () => { calculator.appendNumber(button.innerText); calculator.updateDisplay(); });
});

document.querySelectorAll('[data-operation]').forEach(button => {
    button.addEventListener('click', () => { calculator.chooseOperation(button.dataset.operation); calculator.updateDisplay(); });
});

document.querySelectorAll('[data-single-op]').forEach(button => {
    button.addEventListener('click', () => { calculator.computeSingleOperand(button.dataset.singleOp); calculator.updateDisplay(); });
});

document.querySelectorAll('[data-constant]').forEach(button => {
    button.addEventListener('click', () => { calculator.appendConstant(button.dataset.constant); calculator.updateDisplay(); });
});

document.querySelector('[data-equals]').addEventListener('click', () => { calculator.compute(); calculator.updateDisplay(); });
document.querySelector('[data-all-clear]').addEventListener('click', () => { calculator.clear(); calculator.updateDisplay(); });
document.querySelector('[data-delete]').addEventListener('click', () => { calculator.delete(); calculator.updateDisplay(); });
