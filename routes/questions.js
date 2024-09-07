const router = require('express').Router();
let Question = require('../models/question.model');

router.route('/').get(async (req, res) => {
  try {
    const questions = await Question.find();
    res.json(questions);
  } catch (err) {
    res.status(400).json('Error: ' + err);
  }
});

router.route('/add').post(async (req, res) => {
  try {
    const { question, answer } = req.body;
    const newQuestion = new Question({ question, answer });
    await newQuestion.save();
    res.json('Question added!');
  } catch (err) {
    res.status(400).json('Error: ' + err);
  }
});

router.route('/random').get(async (req, res) => {
  console.log('Received request for random question');
  try {
    const count = await Question.countDocuments();
    console.log('Number of questions:', count);
    if (count === 0) {
      return res.status(404).json({ message: 'No questions found' });
    }
    const random = Math.floor(Math.random() * count);
    const result = await Question.findOne().skip(random);
    if (!result) {
      console.error('No question found');
      return res.status(404).json({ message: 'No question found' });
    }
    console.log('Sending random question:', result);
    res.json(result);
  } catch (err) {
    console.error('Error fetching random question:', err);
    res.status(500).json({ message: 'Error fetching question', error: err.message });
  }
});

// Add this route temporarily for testing
router.route('/addtest').get(async (req, res) => {
  try {
    const newQuestion = new Question({
      question: "What is 2 + 2?",
      answer: 4
    });
    await newQuestion.save();
    res.json('Test question added!');
  } catch (err) {
    res.status(400).json('Error: ' + err);
  }
});

router.route('/addmultiple').get(async (req, res) => {
  try {
    const questionsToAdd = [
      { question: "What is 5 + 7?", answer: 12 },
      { question: "What is 10 - 3?", answer: 7 },
      { question: "What is 4 * 6?", answer: 24 },
      { question: "What is 20 / 4?", answer: 5 }
    ];

    for (let q of questionsToAdd) {
      const newQuestion = new Question(q);
      await newQuestion.save();
    }

    res.json('Multiple test questions added!');
  } catch (err) {
    res.status(400).json('Error: ' + err);
  }
});

// Add this function to generate random math questions
function generateMathQuestion() {
  const operations = ['+', '-', '*', '/'];
  const operation = operations[Math.floor(Math.random() * operations.length)];
  let num1, num2, answer;

  switch (operation) {
    case '+':
      num1 = Math.floor(Math.random() * 100);
      num2 = Math.floor(Math.random() * 100);
      answer = num1 + num2;
      break;
    case '-':
      num1 = Math.floor(Math.random() * 100);
      num2 = Math.floor(Math.random() * num1);
      answer = num1 - num2;
      break;
    case '*':
      num1 = Math.floor(Math.random() * 12);
      num2 = Math.floor(Math.random() * 12);
      answer = num1 * num2;
      break;
    case '/':
      num2 = Math.floor(Math.random() * 11) + 1;
      answer = Math.floor(Math.random() * 10);
      num1 = num2 * answer;
      break;
  }

  return {
    question: `What is ${num1} ${operation} ${num2}?`,
    answer: answer
  };
}

// Add a new route to generate and add 100 questions
router.route('/generate100').get(async (req, res) => {
  try {
    for (let i = 0; i < 100; i++) {
      const { question, answer } = generateMathQuestion();
      const newQuestion = new Question({ question, answer });
      await newQuestion.save();
    }
    res.json('100 questions added successfully!');
  } catch (err) {
    res.status(400).json('Error: ' + err);
  }
});

module.exports = router;