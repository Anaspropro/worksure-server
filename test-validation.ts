import { validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateJobDto } from './src/modules/jobs/dto/create-job.dto';

const payload = {
  title: "",
  description: "",
  budget: 0,
  category: "",
  requiredSkills: [],
  location: "Remote",
};

const dto = plainToInstance(CreateJobDto, payload);
const errors = validateSync(dto, {
  whitelist: true,
  forbidNonWhitelisted: true,
});

if (errors.length > 0) {
  console.log("Validation Failed:");
  console.log(errors.map((e: any) => e.constraints));
} else {
  console.log("Validation Passed");
}
