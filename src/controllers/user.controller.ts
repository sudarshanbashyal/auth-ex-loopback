import {authenticate, TokenService} from '@loopback/authentication';
import {
	Filter,
  repository,
} from '@loopback/repository';
import {
  Credentials,
	MyUserService,
  TokenServiceBindings,
  UserServiceBindings,
} from '@loopback/authentication-jwt';
import {
  post,
  param,
  get,
  getModelSchemaRef,
  requestBody,
  response,
	SchemaObject,
	Request,
	RestBindings,
} from '@loopback/rest';
import {inject} from '@loopback/core';
import {SecurityBindings, securityId, UserProfile} from '@loopback/security';
import {UserRepository} from '../repositories/user.repository';
import {User} from '../models/user.model';

const CredentialsSchema: SchemaObject = {
  type: 'object',
  required: ['email', 'password'],
  properties: {
    email: {
      type: 'string',
      format: 'email',
    },
    password: {
      type: 'string',
      minLength: 8,
    },
  },
};

export const CredentialsRequestBody = {
  description: 'The input of login function',
  required: true,
  content: {
    'application/json': {schema: CredentialsSchema},
  },
};

export class UserController {
  constructor(
		@inject(TokenServiceBindings.TOKEN_SERVICE)
    public jwtService: TokenService,
    @inject(UserServiceBindings.USER_SERVICE)
    public userService: MyUserService,
    @inject(SecurityBindings.USER, {optional: true})
    public user: UserProfile,
    @repository(UserRepository) protected userRepository: UserRepository,
  ) {}

  @post('/users')
  @response(200, {
    description: 'User model instance',
    content: {'application/json': {schema: getModelSchemaRef(User)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(User, {
            title: 'NewUser',
            exclude: ['id'],
          }),
        },
      },
    })
    user: Omit<User, 'id'>,
  ): Promise<User> {
    return this.userRepository.create(user);
  }

	 @post('/users/login', {
    responses: {
      '200': {
        description: 'Token',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                token: {
                  type: 'string',
                },
              },
            },
          },
        },
      },
    },
  })
  async login(
    @requestBody(CredentialsRequestBody) credentials: Credentials,
  ): Promise<{token: string}> {
		const user = await this.userRepository.findOne(
			{
				where: {
					email:credentials.email, 
					password: credentials.password
				}
			}
		)

		const token = await this.jwtService.generateToken({
			name: user!.email,
			id: user!.id,
			[securityId]: user!.email
		});
		return {
			token
		}
  }

	@authenticate('jwt')
  @get('/whoami')
  @response(200, {
    description: 'Array of User model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(User, {includeRelations: true}),
        },
      },
    },
  })
  async find(
		@inject(RestBindings.Http.REQUEST) request: Request,
  ): Promise<User | null> {
		const token = request.header('authorization')?.split(" ")[1] || ""
		const payload = await this.jwtService.verifyToken(token)	
		return this.userRepository.findOne({
			where:{
				email: payload.email
			}
		});
  }
}
